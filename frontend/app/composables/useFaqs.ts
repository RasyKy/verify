export function useFaqs() {
  return [
    {
      q: 'How does certificate verification work?',
      a: 'When you issue a certificate, Verify creates a digital fingerprint of the recipient details. Anyone verifying re-checks that fingerprint — if it matches, the certificate is genuine. Changing any field breaks the match, making the certificate immediately show as invalid.',
    },
    {
      q: 'Who can verify a certificate?',
      a: 'Anyone — employers, universities, event organisers, or members of the public. Verification is public and requires no account. Verifiers just scan the QR code or visit the certificate URL.',
    },
    {
      q: 'What happens if I need to revoke a certificate?',
      a: 'Issuers can revoke any certificate from the dashboard with one click. The change takes effect immediately. Any subsequent verification attempt will return a "Revoked" status, so recipients can no longer present the certificate as valid.',
    },
    {
      q: 'Do recipients need to create an account?',
      a: 'No. Recipients receive their certificate as a direct link by email and can view and share it immediately — no account required. They can optionally save the certificate to a personal dashboard for privacy controls, but this is never required for sharing or verification.',
    },
    {
      q: "Who owns my institution's credential data?",
      a: 'Your institution does. Recipient names, emails, and certificate details are stored securely in your account and are never sold or shared with third parties. You can export or delete your data at any time.',
    },
  ]
}
