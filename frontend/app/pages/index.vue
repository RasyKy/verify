<script setup lang="ts">
definePageMeta({ layout: 'default' })

const faqs = useFaqs()

useSeoMeta({
  title: 'Verify — Issue digital certificates your recipients actually trust',
  description:
    'Verify lets institutions issue, manage, and revoke digital credentials that recipients can share and employers can check instantly — in minutes, not days.',
  ogTitle: 'Verify — Issue digital certificates your recipients actually trust',
  ogDescription:
    'Verify lets institutions issue, manage, and revoke digital credentials that recipients can share and employers can check instantly — in minutes, not days.',
  ogImage: '/og-image.svg',
  ogUrl: 'https://verify.app',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

useHead({
  link: [{ rel: 'canonical', href: 'https://verify.app' }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            name: 'Verify',
            url: 'https://verify.app',
            logo: 'https://verify.app/og-image.svg',
          },
          {
            '@type': 'SoftwareApplication',
            name: 'Verify',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'Digital certificate issuance and verification platform for educational institutions.',
          },
          {
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: {
                '@type': 'Answer',
                text: f.a,
              },
            })),
          },
        ],
      }),
    },
  ],
})
</script>

<template>
  <div>
    <LandingHeroSection />
    <LazyLandingTrustBar :hydrate-on-idle="true" />
    <LazyLandingAudienceStrip hydrate-on-visible />
    <LazyLandingFeaturesSection hydrate-on-visible />
    <LazyLandingDashboardMock hydrate-on-visible />
    <LazyLandingHowItWorks hydrate-on-visible />
    <LazyLandingForHolders hydrate-on-visible />
    <LazyLandingFaqSection :hydrate-on-idle="true" />
    <LazyLandingCtaSection :hydrate-on-idle="true" />
  </div>
</template>
