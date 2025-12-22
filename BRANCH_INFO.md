# Branch Strategy

This repository uses a branch-based approach to maintain both web app and Shopify app versions.

## Branches

### `master` (main branch)
- Standalone web application
- Firebase authentication
- Deployed to Vercel
- Direct URL access

### `shopify-app`
- Shopify embedded application
- Shopify OAuth authentication
- Shopify App Bridge integration
- Installed via Shopify Partners

## Working with Both Versions

### Switching Between Branches

```bash
# Switch to web app
git checkout master

# Switch to Shopify app
git checkout shopify-app
```

### Merging Changes

**From master to shopify-app** (get latest features):

```bash
git checkout shopify-app
git merge master
# Resolve conflicts if any
git push origin shopify-app
```

**From shopify-app to master** (backport Shopify-compatible features):

```bash
git checkout master
git merge shopify-app
# Carefully review - may need to exclude Shopify-specific code
git push origin master
```

## Shared Components

These components work in both versions:
- `components/MockupGenerator.tsx`
- `components/CaptionReview.tsx`
- `components/Calendar/*`
- `services/geminiService.ts`
- `services/mockupStorageService.ts`
- `services/scheduledPostsService.ts`

Changes to these should be merged between branches.

## Version-Specific Code

### Web App Only (master)
- Firebase Auth in `components/AuthProvider.tsx`
- Direct sign-in page

### Shopify App Only (shopify-app)
- `shopify.config.ts`
- `services/shopifyAuthService.ts`
- `components/ShopifyProvider.tsx`
- Shopify dependencies in `package.json`

## Development Workflow

1. **Bug fixes** in shared components:
   - Fix in either branch
   - Merge to the other branch

2. **New features** in shared components:
   - Develop in `master` first
   - Merge to `shopify-app`
   - Test in both contexts

3. **Shopify-specific features**:
   - Develop only in `shopify-app`
   - Don't merge to `master`

4. **Web-specific features**:
   - Develop only in `master`
   - Don't merge to `shopify-app`

## Environment Variables

Both branches share Firebase and Gemini config but differ in auth:

### master (.env.local)
```env
VITE_APP_MODE=standalone
VITE_FIREBASE_API_KEY=...
VITE_GEMINI_API_KEY=...
```

### shopify-app (.env.local)
```env
VITE_APP_MODE=shopify
VITE_SHOPIFY_API_KEY=...
VITE_SHOPIFY_API_SECRET=...
VITE_FIREBASE_API_KEY=...
VITE_GEMINI_API_KEY=...
```

## When to Fork Instead

Consider forking into a separate repository if:
- The versions diverge significantly (>30% different code)
- You need different CI/CD pipelines
- Different teams maintain each version
- Merge conflicts become too frequent

Current recommendation: **Keep using branches** until complexity requires a fork.

## Migration Path to Monorepo

If you later want to combine both in one codebase:

```
socialstitch/
├── packages/
│   ├── core/       # Shared code
│   ├── web/        # Standalone app
│   └── shopify/    # Embedded app
└── package.json    # Workspace
```

This can be done by:
1. Create `packages/` structure
2. Move shared code to `packages/core`
3. Move web-specific to `packages/web`
4. Move Shopify-specific to `packages/shopify`
5. Update imports and build config

## Best Practices

✅ **Do:**
- Keep shared components identical
- Merge regularly to avoid drift
- Document version-specific features
- Test changes in both versions when touching shared code

❌ **Don't:**
- Make conflicting changes to shared components
- Let branches diverge for months
- Forget to update both `.env.local` files
- Mix web and Shopify authentication logic

## Questions?

Refer to:
- [SHOPIFY_SETUP.md](./SHOPIFY_SETUP.md) - Shopify app setup
- [README.md](./README.md) - Web app setup




