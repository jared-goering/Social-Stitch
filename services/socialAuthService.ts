/**
 * Social Authentication Service
 * Handles OAuth flows and posting to social platforms via Firebase Functions
 */

import { getFunctionUrl, sessionId } from './firebaseConfig';
import { SocialPlatform } from '../types';

export interface ConnectedAccount {
  connected: boolean;
  username: string;
  pageId?: string;
  pageName?: string;
}

export type AccountsMap = Record<SocialPlatform, ConnectedAccount>;

const DEFAULT_ACCOUNTS: AccountsMap = {
  facebook: { connected: false, username: '' },
  instagram: { connected: false, username: '' }
};

/**
 * Open OAuth popup window for connecting a social account
 */
export function startOAuthFlow(platform: SocialPlatform): Promise<boolean> {
  return new Promise((resolve) => {
    const authUrl = `${getFunctionUrl('authStart')}?sessionId=${sessionId}&platform=${platform}`;
    
    // Calculate popup position (centered)
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      'SocialStitch OAuth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      console.error('Popup blocked. Please allow popups for this site.');
      resolve(false);
      return;
    }

    // Poll for popup close and check URL params
    const pollTimer = setInterval(() => {
      try {
        // Check if popup is closed
        if (popup.closed) {
          clearInterval(pollTimer);
          // Check current page URL for auth result
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('auth_success') === platform) {
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
            resolve(true);
          } else {
            resolve(false);
          }
        }
        
        // Try to read popup location (will fail if on different origin)
        const popupUrl = popup.location.href;
        if (popupUrl.includes(window.location.origin)) {
          const popupParams = new URLSearchParams(new URL(popupUrl).search);
          if (popupParams.get('auth_success')) {
            clearInterval(pollTimer);
            popup.close();
            resolve(true);
          } else if (popupParams.get('auth_error')) {
            clearInterval(pollTimer);
            popup.close();
            const error = popupParams.get('auth_error');
            console.error('OAuth error:', error);
            resolve(false);
          }
        }
      } catch {
        // Cross-origin error - popup is still on Meta's domain, keep waiting
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollTimer);
      if (!popup.closed) {
        popup.close();
      }
      resolve(false);
    }, 5 * 60 * 1000);
  });
}

/**
 * Fetch connected accounts from Firebase
 */
export async function getConnectedAccounts(): Promise<AccountsMap> {
  try {
    const response = await fetch(
      `${getFunctionUrl('getConnectedAccounts')}?sessionId=${sessionId}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch accounts');
    }

    const data = await response.json();
    
    return {
      facebook: data.accounts?.facebook || DEFAULT_ACCOUNTS.facebook,
      instagram: data.accounts?.instagram || DEFAULT_ACCOUNTS.instagram
    };
  } catch (error) {
    console.error('Error fetching connected accounts:', error);
    return DEFAULT_ACCOUNTS;
  }
}

/**
 * Disconnect a social account
 */
export async function disconnectAccount(platform: SocialPlatform): Promise<boolean> {
  try {
    const response = await fetch(getFunctionUrl('disconnectAccount'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        platform
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error disconnecting account:', error);
    return false;
  }
}

/**
 * Convert image URL to base64
 */
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Post content to a social platform
 */
export async function postToSocial(
  platform: SocialPlatform,
  imageUrl: string,
  caption: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const functionName = platform === 'facebook' ? 'postToFacebook' : 'postToInstagram';
    
    // Convert image to base64 if it's a local/blob URL
    let imageBase64: string | undefined;
    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:') || imageUrl.includes('localhost')) {
      console.log('Converting image to base64 for upload...');
      imageBase64 = await imageUrlToBase64(imageUrl);
    }
    
    const response = await fetch(getFunctionUrl(functionName), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        imageUrl: imageBase64 ? undefined : imageUrl,
        imageBase64,
        caption
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to post' };
    }

    return { success: true, postId: data.postId };
  } catch (error) {
    console.error('Error posting to social:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Listen for auth result via URL params (called after popup redirect)
 */
export function checkAuthResult(): { success: boolean; platform?: string; error?: string } {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('auth_success');
  const error = urlParams.get('auth_error');
  
  // Clean up URL params
  if (success || error) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (success) {
    return { success: true, platform: success };
  }
  
  if (error) {
    return { success: false, error: decodeURIComponent(error) };
  }

  return { success: false };
}

