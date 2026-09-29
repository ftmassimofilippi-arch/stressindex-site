import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/area-professionisti/login', '/en/area-professionisti/login', '/de/area-professionisti/login'],
        disallow: ['/api/', '/area-professionisti/', '/en/area-professionisti/', '/de/area-professionisti/'],
      },
    ],
    sitemap: 'https://stressindex.io/sitemap.xml',
    host: 'https://stressindex.io',
  }
}
