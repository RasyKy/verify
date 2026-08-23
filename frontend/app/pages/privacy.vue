<script setup lang="ts">
definePageMeta({ layout: 'default' })

const UPDATED = '2026-08-23'

useSeoMeta({
  title: 'Privacy policy — Verify',
  description:
    'What Verify collects, what is written to the blockchain (only a hash), who can see a certificate, and how to have your data corrected or removed.',
  ogTitle: 'Privacy policy — Verify',
  ogDescription:
    'What Verify collects, what is written to the blockchain, and how to have your data corrected or removed.',
})

useHead({ link: [{ rel: 'canonical', href: 'https://verify.app/privacy' }] })
</script>

<template>
  <LegalPage
    title="Privacy policy"
    :updated="UPDATED"
    lead="Verify exists so a certificate can prove itself without anyone having to hand over more information than the certificate already contains. This page says exactly what we store, what goes on a public blockchain, and what you can ask us to change."
  >
    <div class="note">
      <p>
        <strong>The short version.</strong> Your name, email and course details
        are stored in our database — never on the blockchain. The only thing
        written to the chain is a one-way hash: a fixed-length fingerprint that
        cannot be reversed back into your details.
      </p>
    </div>

    <h2>1. Who this covers</h2>
    <p>
      This policy covers everyone who touches Verify: <strong>holders</strong>
      who have been awarded a certificate, <strong>issuers</strong> who work for
      an institution that issues them, <strong>administrators</strong> who run
      the platform, and anyone who verifies a certificate without an account at
      all.
    </p>
    <p>
      Your certificate is issued by an institution, not by us. That institution
      decided what the certificate says and who receives it, and it is
      independently responsible for its own handling of your data.
    </p>

    <h2>2. What we collect</h2>

    <h3>Account information</h3>
    <ul>
      <li>Your email address, which is how you sign in and how claim links reach you.</li>
      <li>Your name, as the issuing institution recorded it.</li>
      <li>
        A password, if you chose to set one. Passwords are hashed by our
        authentication provider and are never visible to us or to your institution.
      </li>
      <li>
        For issuers and administrators, the organisation the account belongs to
        and the role it holds.
      </li>
    </ul>

    <h3>Certificate information</h3>
    <ul>
      <li>The certificate ID, your name, the course or award, and the completion and expiry dates.</li>
      <li>The issuing institution, and whether the certificate is active, revoked or expired.</li>
      <li>The email address the certificate was issued to, so the claim link could reach you.</li>
    </ul>

    <h3>Verification records</h3>
    <p>
      Every verification of a certificate is logged, so that issuers can see
      that their credentials are being checked and so we can detect abuse. A log
      entry records the certificate, the result, the time, the browser's
      user-agent string, and a <strong>hash of the IP address</strong> rather
      than the address itself. We do not build profiles of the people who verify
      certificates, and we do not know who they are.
    </p>

    <h3>Administrative records</h3>
    <p>
      Actions that change something meaningful — issuing, revoking, suspending
      an institution, deactivating an account — are recorded in an audit log
      with the account that performed them. This log is what makes the platform
      accountable, and it is deliberately not editable.
    </p>

    <h2>3. What goes on the blockchain</h2>
    <p>
      This is the part people most often assume wrongly, so it is worth being
      precise.
    </p>
    <p>
      When a certificate is issued, we compute a <strong>SHA-256 hash</strong>
      of a fixed string built from the certificate ID, the holder's name, the
      course name, and the completion and expiry dates. That hash — and only
      that hash — is written to the Polygon blockchain, along with the time it
      was recorded.
    </p>
    <p><strong>What is never written to the blockchain:</strong></p>
    <ul>
      <li>Your name, in readable form</li>
      <li>Your email address</li>
      <li>The name of your course or award, in readable form</li>
      <li>Any document, image or PDF</li>
    </ul>
    <p>
      A hash is one-way. Someone reading the chain sees a 32-byte value and the
      time it was recorded; they cannot work backwards from it to your name. It
      is only useful to someone who <em>already</em> holds the certificate
      details and wants to check that they have not been altered — which is
      exactly what verification does.
    </p>

    <div class="note">
      <p>
        <strong>Blockchain entries are permanent.</strong> Nobody — not us, not
        your institution — can delete a hash once it has been recorded. This is
        what makes the record trustworthy, and it is also a genuine limit on
        erasure: see section 7.
      </p>
    </div>

    <h2>4. Who can see your certificate</h2>
    <p>
      Anyone holding a certificate ID can verify it. That is the point of the
      product: a certificate you cannot check is not worth much. What you
      control is <strong>discoverability</strong>, not verifiability.
    </p>
    <ul>
      <li>
        <strong>Hiding a certificate</strong> removes it from your public
        holder profile. Someone who already has the specific certificate ID or
        QR code can still verify it.
      </li>
      <li>
        <strong>Making your profile private</strong> means your list of
        certificates is not browsable as a set.
      </li>
    </ul>
    <p>
      We are stating this plainly because it would be easy to read "hidden" as
      "unverifiable", and then be surprised. Verification cannot be switched
      off by the holder — an employer must be able to trust that a certificate
      which checks out has not been quietly retracted from view.
    </p>

    <h2>5. How we use what we collect</h2>
    <p>We use your information to:</p>
    <ul>
      <li>Issue, display and verify certificates</li>
      <li>Let you sign in and prove that a certificate belongs to you</li>
      <li>Email you a claim link when a certificate is issued to you, and warn you before one expires</li>
      <li>Show issuers how their own certificates are performing</li>
      <li>Investigate abuse and keep the platform secure</li>
    </ul>
    <p>
      We do not sell your data, we do not share it with advertisers, and we do
      not use it to train anything.
    </p>

    <h2>6. Who we share it with</h2>
    <ul>
      <li>
        <strong>Your issuing institution</strong> can see the certificates it
        issued to you and whether they have been claimed.
      </li>
      <li>
        <strong>Anyone you give a certificate link to</strong> sees the details
        printed on that certificate.
      </li>
      <li>
        <strong>Service providers</strong> that run parts of the platform: our
        database and authentication host, our email provider, and the public
        Polygon network.
      </li>
      <li>
        <strong>Authorities</strong>, where we are legally required to.
      </li>
    </ul>

    <h2>7. Keeping and deleting data</h2>
    <p>
      Certificates are kept for as long as the issuing institution wants them to
      remain verifiable, which is normally indefinitely — a degree that stops
      verifying after five years is not much of a degree.
    </p>
    <p>
      You can ask us to delete your <strong>account</strong>, and we will. Two
      honest limits apply:
    </p>
    <ul>
      <li>
        The <strong>certificate record</strong> belongs to the issuing
        institution's account of what it awarded. Removing it is a request to
        make with them, not with us.
      </li>
      <li>
        The <strong>blockchain hash cannot be removed by anyone</strong>. It
        contains no readable personal data, but it is permanent. If a
        certificate should no longer be relied upon, the correct remedy is
        revocation — which makes every future verification return "Revoked" —
        not deletion.
      </li>
    </ul>

    <h2>8. Your rights</h2>
    <p>
      You can ask for a copy of what we hold about you, ask us to correct
      something that is wrong, ask us to delete your account, or object to how
      we are using your information. Write to
      <a :href="`mailto:${SITE_CONTACT.privacy}`">{{ SITE_CONTACT.privacy }}</a>
      and we will respond within 30 days.
    </p>
    <p>
      If the thing that is wrong is printed <em>on a certificate</em> — a
      misspelled name, the wrong date — contact the institution that issued it.
      Correcting a certificate changes its hash, so the institution has to
      reissue it, and only they can decide to do that.
    </p>

    <h2>9. Security</h2>
    <p>
      Access is enforced by role on every request, not just hidden in the
      interface. Passwords are hashed by our authentication provider. Claim
      links are single-use and expire. Verification logs store a hashed IP
      rather than the address itself.
    </p>
    <p>
      If you believe you have found a vulnerability, please write to
      <a :href="`mailto:${SITE_CONTACT.security}`">{{ SITE_CONTACT.security }}</a>
      rather than disclosing it publicly, and give us a reasonable window to fix
      it.
    </p>

    <h2>10. Changes to this policy</h2>
    <p>
      If we change it in a way that materially affects you, we will say so on
      this page and update the date at the top. Continuing to use Verify after a
      change means you accept it.
    </p>

    <h2>11. Contact</h2>
    <p>
      Privacy questions:
      <a :href="`mailto:${SITE_CONTACT.privacy}`">{{ SITE_CONTACT.privacy }}</a>.
      Anything else: <NuxtLink to="/contact">our contact page</NuxtLink>.
    </p>
  </LegalPage>
</template>
