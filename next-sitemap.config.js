/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: 'https://socialstitch.io',
  generateRobotsTxt: true,
  exclude: ['/app', '/app/*'],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/', disallow: ['/app'] },
    ],
  },
};

export default config;
