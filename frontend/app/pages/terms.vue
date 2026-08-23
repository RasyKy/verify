<script setup lang="ts">
definePageMeta({ layout: 'default' })

const UPDATED = '2026-08-23'

useSeoMeta({
  title: 'Terms of service — Verify',
  description:
    'The terms for using Verify: what a verification result does and does not prove, what institutions and holders are each responsible for, and the limits of the service.',
  ogTitle: 'Terms of service — Verify',
  ogDescription:
    'What a verification result proves, what institutions and holders are responsible for, and the limits of the service.',
})

useHead({ link: [{ rel: 'canonical', href: 'https://verify.app/terms' }] })
</script>

<template>
  <LegalPage
    title="Terms of service"
    :updated="UPDATED"
    lead="Plain terms for a narrow product. Verify checks whether a certificate matches the record its issuer anchored on a blockchain. It does not vouch for the institution, and it does not decide whether you earned the award."
  >
    <div class="note">
      <p>
        <strong>Development status.</strong> Verify currently anchors
        certificates on the <strong>Polygon Amoy test network</strong>, not
        Polygon mainnet. Test networks carry no economic guarantees and can be
        reset by their operators. Until this changes, treat Verify as a
        demonstration and pilot platform rather than a system of record.
      </p>
    </div>

    <h2>1. Accepting these terms</h2>
    <p>
      By using Verify — signing in, issuing a certificate, claiming one, or
      checking one — you accept these terms. If you are using Verify for an
      institution, you confirm you are authorised to accept them on its behalf.
    </p>

    <h2>2. What Verify actually does</h2>
    <p>
      When a certificate is issued, we compute a fingerprint (a hash) of its
      details and record that fingerprint on a public blockchain. When someone
      verifies the certificate, we recompute the fingerprint from our stored
      details and compare it to what is on the chain.
    </p>
    <p>A verification result therefore tells you one of four things:</p>
    <ul>
      <li>
        <strong>Verified</strong> — the details match the record the issuer
        anchored, the certificate has not been revoked, and it has not expired.
      </li>
      <li>
        <strong>Revoked</strong> — the issuing institution has withdrawn this
        certificate. Why is between them and the holder.
      </li>
      <li>
        <strong>Expired</strong> — genuine, but past the expiry date the issuer
        set.
      </li>
      <li>
        <strong>Invalid</strong> — no matching record was found, or the details
        do not match the anchored fingerprint.
      </li>
    </ul>

    <div class="note">
      <p>
        <strong>What "Verified" does not mean.</strong> It means the certificate
        has not been altered since the institution issued it. It does not mean
        the institution is reputable, accredited, or telling the truth about
        what the holder did. A perfectly verifiable certificate from a
        worthless institution is still worthless — verification proves
        integrity, not merit.
      </p>
    </div>

    <h2>3. Accounts</h2>
    <p>There is no open sign-up, and that is deliberate:</p>
    <ul>
      <li>
        <strong>Issuer and administrator accounts</strong> are created by a
        platform administrator. An issuer can attest that someone graduated, so
        letting anyone register as one would make the whole registry
        meaningless.
      </li>
      <li>
        <strong>Holder accounts</strong> are created by claiming a certificate.
        The claim link is sent to the address the institution issued the
        certificate to, works once, and expires.
      </li>
    </ul>
    <p>
      You are responsible for what happens under your account. Tell us promptly
      if you think someone else has access to it.
    </p>

    <h2>4. If you issue certificates</h2>
    <p>By issuing through Verify, your institution agrees that:</p>
    <ul>
      <li>
        Every certificate reflects something the named person genuinely
        achieved. You are the only party who can know this, and the entire
        product rests on you being honest about it.
      </li>
      <li>
        You have the right to process the personal details you enter, and to
        send a claim link to the address you provide.
      </li>
      <li>
        You will <strong>revoke</strong> a certificate promptly if it was issued
        in error or should no longer be relied upon. Revocation is the remedy;
        deletion is not available, because the blockchain record is permanent.
      </li>
      <li>
        Details cannot be edited after issuance. Any change to the name, course
        or dates changes the fingerprint, so a correction means revoking and
        reissuing.
      </li>
    </ul>
    <p>
      We may suspend an institution that issues fraudulent certificates.
      Certificates already issued under a suspended institution stay verifiable
      — revoking them would punish the graduates for their institution's
      conduct.
    </p>

    <h2>5. If you hold a certificate</h2>
    <ul>
      <li>Claim only certificates issued to you.</li>
      <li>
        You may share a certificate with anyone. You may hide it from your
        public profile at any time — but hiding is not the same as revoking, and
        anyone already holding the link can still verify it.
      </li>
      <li>
        Do not misrepresent what a certificate says, and do not present someone
        else's as your own.
      </li>
    </ul>

    <h2>6. Acceptable use</h2>
    <p>Do not:</p>
    <ul>
      <li>Issue certificates for achievements that did not happen</li>
      <li>Attempt to claim a certificate that is not yours</li>
      <li>Probe, scrape or overload the verification service</li>
      <li>Attempt to bypass role restrictions or access another account's data</li>
      <li>Use Verify to break any applicable law</li>
    </ul>
    <p>
      We may suspend accounts that do these things. Security researchers acting
      in good faith should read the disclosure note in our
      <NuxtLink to="/privacy">privacy policy</NuxtLink> first.
    </p>

    <h2>7. Availability</h2>
    <p>
      Verify is provided as-is. We aim to keep it available but do not promise
      uninterrupted service, and parts of it depend on infrastructure we do not
      control — a public blockchain network, an authentication provider, an
      email provider.
    </p>
    <p>
      If verification is temporarily unavailable, the interface says so
      explicitly rather than reporting certificates as invalid. A service
      outage is never evidence that a certificate is fake.
    </p>

    <h2>8. Limits of liability</h2>
    <p>
      To the extent the law allows, Verify is not liable for indirect or
      consequential loss arising from use of the service — including decisions
      made in reliance on a verification result, loss of access to an account,
      or the conduct of any institution or holder on the platform.
    </p>
    <p>
      Nothing here limits liability that cannot be limited by law.
    </p>

    <h2>9. Ending your use</h2>
    <p>
      You may stop using Verify at any time and ask us to delete your account.
      We may suspend or close an account that breaches these terms. Certificates
      that have already been issued remain verifiable regardless — that is what
      the people relying on them are entitled to.
    </p>

    <h2>10. Changes</h2>
    <p>
      We may update these terms. Material changes will be noted on this page
      with a new date at the top, and continuing to use Verify after that means
      you accept them.
    </p>

    <h2>11. Governing law</h2>
    <p>
      These terms are governed by the laws of the Kingdom of Cambodia, and the
      courts of Phnom Penh have exclusive jurisdiction over any dispute arising
      from them.
    </p>

    <h2>12. Contact</h2>
    <p>
      Questions about these terms:
      <a :href="`mailto:${SITE_CONTACT.support}`">{{ SITE_CONTACT.support }}</a>,
      or see <NuxtLink to="/contact">our contact page</NuxtLink>.
    </p>
  </LegalPage>
</template>
