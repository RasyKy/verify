export interface Org {
  id: string
  name: string
  type: 'university' | 'bootcamp' | 'professional-body' | 'event'
  website: string
  issuersCount: number
  certificatesCount: number
  status: 'active' | 'suspended'
  createdAt: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: 'issuer' | 'recipient'
  organizationId: string
  organizationName: string
  status: 'active' | 'deactivated'
  joinedAt: string
}

export interface AdminCert {
  id: string
  recipientName: string
  recipientEmail: string
  courseName: string
  organizationId: string
  organizationName: string
  issuedAt: string
  status: 'issued' | 'revoked'
  revokedAt?: string
}

export type AuditAction =
  | 'certificate.issued'
  | 'certificate.revoked'
  | 'issuer.invited'
  | 'issuer.removed'
  | 'org.created'
  | 'org.suspended'

export interface AuditEvent {
  id: string
  timestamp: string
  actorName: string
  actorEmail: string
  action: AuditAction
  targetLabel: string
  organizationId: string
  organizationName: string
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const seedOrgs: Org[] = [
  { id: 'org-1', name: 'Royal Phnom Penh University',    type: 'university',       website: 'rppu.edu.kh',         issuersCount: 2, certificatesCount: 12, status: 'active',    createdAt: '2024-09-01' },
  { id: 'org-2', name: 'Passerelles Numériques Cambodia', type: 'bootcamp',          website: 'pnc.org',             issuersCount: 2, certificatesCount: 10, status: 'active',    createdAt: '2024-10-15' },
  { id: 'org-3', name: 'Digital Futures Institute',       type: 'bootcamp',          website: 'dfi.kh',              issuersCount: 1, certificatesCount: 8,  status: 'active',    createdAt: '2025-01-08' },
  { id: 'org-4', name: 'LICA Professionals Association',  type: 'professional-body', website: 'lica.org.kh',         issuersCount: 1, certificatesCount: 5,  status: 'active',    createdAt: '2025-02-20' },
  { id: 'org-5', name: 'ASEAN Skills Summit 2025',        type: 'event',             website: 'asean2025skills.org', issuersCount: 1, certificatesCount: 4,  status: 'active',    createdAt: '2025-05-10' },
  { id: 'org-6', name: 'Mekong Coding Academy',           type: 'bootcamp',          website: 'mca.edu.kh',          issuersCount: 1, certificatesCount: 1,  status: 'suspended', createdAt: '2024-11-03' },
]

const seedUsers: AdminUser[] = [
  { id: 'usr-1',  name: 'Chan Sothea',    email: 'sothea@rppu.edu.kh',         role: 'issuer',    organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    status: 'active',      joinedAt: '2024-09-01' },
  { id: 'usr-2',  name: 'Morn Chanveasna',email: 'chanveasna@rppu.edu.kh',     role: 'issuer',    organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    status: 'active',      joinedAt: '2024-09-15' },
  { id: 'usr-3',  name: 'Vuth Pisey',     email: 'pisey@pnc.org',              role: 'issuer',    organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', status: 'active',      joinedAt: '2024-10-15' },
  { id: 'usr-4',  name: 'Lim Sokha',      email: 'sokha.admin@pnc.org',        role: 'issuer',    organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', status: 'active',      joinedAt: '2024-11-01' },
  { id: 'usr-5',  name: 'Keo Ratanak',    email: 'ratanak@dfi.kh',             role: 'issuer',    organizationId: 'org-3', organizationName: 'Digital Futures Institute',       status: 'active',      joinedAt: '2025-01-08' },
  { id: 'usr-6',  name: 'Noun Sopheap',   email: 'sopheap@lica.org.kh',        role: 'issuer',    organizationId: 'org-4', organizationName: 'LICA Professionals Association',  status: 'active',      joinedAt: '2025-02-20' },
  { id: 'usr-7',  name: 'Tep Chanthy',    email: 'chanthy@asean2025skills.org',role: 'issuer',    organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025',        status: 'active',      joinedAt: '2025-05-10' },
  { id: 'usr-8',  name: 'Sok Vanna',      email: 'vanna@mca.edu.kh',           role: 'issuer',    organizationId: 'org-6', organizationName: 'Mekong Coding Academy',           status: 'deactivated', joinedAt: '2024-11-03' },
  { id: 'usr-9',  name: 'Chea Sophat',    email: 'sophat.chea@gmail.com',      role: 'recipient', organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    status: 'active',      joinedAt: '2025-01-20' },
  { id: 'usr-10', name: 'Nak Piseth',     email: 'piseth.nak@gmail.com',       role: 'recipient', organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    status: 'active',      joinedAt: '2025-02-05' },
  { id: 'usr-11', name: 'Meas Rattana',   email: 'rattana.meas@gmail.com',     role: 'recipient', organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    status: 'active',      joinedAt: '2025-03-10' },
  { id: 'usr-12', name: 'Lim Sreymom',    email: 'sreymom.lim@gmail.com',      role: 'recipient', organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', status: 'active',      joinedAt: '2025-02-12' },
  { id: 'usr-13', name: 'Heng Bopha',     email: 'bopha.heng@gmail.com',       role: 'recipient', organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', status: 'active',      joinedAt: '2025-03-01' },
  { id: 'usr-14', name: 'Sek Chandarith', email: 'chandarith.sek@gmail.com',   role: 'recipient', organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', status: 'active',      joinedAt: '2025-04-15' },
  { id: 'usr-15', name: 'Sorn Dara',      email: 'dara.sorn@gmail.com',        role: 'recipient', organizationId: 'org-3', organizationName: 'Digital Futures Institute',       status: 'active',      joinedAt: '2025-02-20' },
  { id: 'usr-16', name: 'Phon Kimleng',   email: 'kimleng.phon@gmail.com',     role: 'recipient', organizationId: 'org-3', organizationName: 'Digital Futures Institute',       status: 'active',      joinedAt: '2025-03-15' },
  { id: 'usr-17', name: 'Pov Sokha',      email: 'sokha.pov@gmail.com',        role: 'recipient', organizationId: 'org-4', organizationName: 'LICA Professionals Association',  status: 'active',      joinedAt: '2025-03-25' },
  { id: 'usr-18', name: 'Kuch Sreynich',  email: 'sreynich.kuch@gmail.com',    role: 'recipient', organizationId: 'org-4', organizationName: 'LICA Professionals Association',  status: 'active',      joinedAt: '2025-05-01' },
  { id: 'usr-19', name: 'Ros Dina',       email: 'dina.ros@gmail.com',         role: 'recipient', organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025',        status: 'active',      joinedAt: '2025-06-01' },
  { id: 'usr-20', name: 'Hy Daro',        email: 'daro.hy@gmail.com',          role: 'recipient', organizationId: 'org-6', organizationName: 'Mekong Coding Academy',           status: 'deactivated', joinedAt: '2025-01-10' },
]

const seedCerts: AdminCert[] = [
  // org-1: Royal Phnom Penh University
  { id: 'cert-001', recipientName: 'Chea Sophat',   recipientEmail: 'sophat.chea@gmail.com',   courseName: 'Web Development Fundamentals',    organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-02-03', status: 'issued' },
  { id: 'cert-002', recipientName: 'Nak Piseth',    recipientEmail: 'piseth.nak@gmail.com',    courseName: 'Data Analytics with Python',       organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-02-10', status: 'issued' },
  { id: 'cert-003', recipientName: 'Meas Rattana',  recipientEmail: 'rattana.meas@gmail.com',  courseName: 'English Communication',            organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-02-18', status: 'issued' },
  { id: 'cert-004', recipientName: 'Oung Vireak',   recipientEmail: 'vireak.oung@gmail.com',   courseName: 'Project Management Essentials',    organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-03-05', status: 'issued' },
  { id: 'cert-005', recipientName: 'Prum Danavy',   recipientEmail: 'danavy.prum@gmail.com',   courseName: 'Blockchain for Developers',         organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-03-12', status: 'issued' },
  { id: 'cert-006', recipientName: 'Sok Chanthy',   recipientEmail: 'chanthy.sok@gmail.com',   courseName: 'Cloud Computing Foundations',       organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-03-20', status: 'revoked', revokedAt: '2025-04-15' },
  { id: 'cert-007', recipientName: 'Touch Kimheng', recipientEmail: 'kimheng.touch@gmail.com', courseName: 'UX Design Principles',              organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-04-02', status: 'issued' },
  { id: 'cert-008', recipientName: 'Yem Sophea',    recipientEmail: 'sophea.yem@gmail.com',    courseName: 'Digital Marketing Strategy',        organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-04-10', status: 'issued' },
  { id: 'cert-009', recipientName: 'Kang Borey',    recipientEmail: 'borey.kang@gmail.com',    courseName: 'Python Programming',                organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-05-08', status: 'issued' },
  { id: 'cert-010', recipientName: 'Chea Sophat',   recipientEmail: 'sophat.chea@gmail.com',   courseName: 'Machine Learning Fundamentals',     organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-05-20', status: 'issued' },
  { id: 'cert-011', recipientName: 'Chan Sokha',    recipientEmail: 'sokha.chan@gmail.com',    courseName: 'Network Security Basics',           organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-06-03', status: 'issued' },
  { id: 'cert-012', recipientName: 'Nak Piseth',    recipientEmail: 'piseth.nak@gmail.com',    courseName: 'Mobile App Development',            organizationId: 'org-1', organizationName: 'Royal Phnom Penh University',    issuedAt: '2025-06-15', status: 'issued' },
  // org-2: Passerelles Numériques Cambodia
  { id: 'cert-013', recipientName: 'Lim Sreymom',   recipientEmail: 'sreymom.lim@gmail.com',   courseName: 'Web Development Fundamentals',      organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-02-07', status: 'issued' },
  { id: 'cert-014', recipientName: 'Heng Bopha',    recipientEmail: 'bopha.heng@gmail.com',    courseName: 'Python Programming',                organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-02-22', status: 'issued' },
  { id: 'cert-015', recipientName: 'Sek Chandarith',recipientEmail: 'chandarith.sek@gmail.com',courseName: 'UX Design Principles',              organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-03-08', status: 'issued' },
  { id: 'cert-016', recipientName: 'Pen Bopha',     recipientEmail: 'bopha.pen@gmail.com',     courseName: 'Digital Marketing Strategy',        organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-03-25', status: 'issued' },
  { id: 'cert-017', recipientName: 'Sam Sreyleak',  recipientEmail: 'sreyleak.sam@gmail.com',  courseName: 'Data Analytics with Python',        organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-04-05', status: 'issued' },
  { id: 'cert-018', recipientName: 'Chhun Pisey',   recipientEmail: 'pisey.chhun@gmail.com',   courseName: 'Mobile App Development',            organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-05-02', status: 'issued' },
  { id: 'cert-019', recipientName: 'Lim Sreymom',   recipientEmail: 'sreymom.lim@gmail.com',   courseName: 'Cloud Computing Foundations',       organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-05-18', status: 'issued' },
  { id: 'cert-020', recipientName: 'Heng Bopha',    recipientEmail: 'bopha.heng@gmail.com',    courseName: 'Project Management Essentials',     organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-06-02', status: 'issued' },
  { id: 'cert-021', recipientName: 'Ros Chanthou',  recipientEmail: 'chanthou.ros@gmail.com',  courseName: 'English Communication',             organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-06-20', status: 'issued' },
  { id: 'cert-022', recipientName: 'Sok Panha',     recipientEmail: 'panha.sok@gmail.com',     courseName: 'Blockchain for Developers',          organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia', issuedAt: '2025-07-01', status: 'revoked', revokedAt: '2025-07-05' },
  // org-3: Digital Futures Institute
  { id: 'cert-023', recipientName: 'Sorn Dara',     recipientEmail: 'dara.sorn@gmail.com',     courseName: 'Machine Learning Fundamentals',     organizationId: 'org-3', organizationName: 'Digital Futures Institute',       issuedAt: '2025-02-14', status: 'issued' },
  { id: 'cert-024', recipientName: 'Phon Kimleng',  recipientEmail: 'kimleng.phon@gmail.com',  courseName: 'Python Programming',                organizationId: 'org-3', organizationName: 'Digital Futures Institute',       issuedAt: '2025-03-03', status: 'issued' },
  { id: 'cert-025', recipientName: 'Nget Sambath',  recipientEmail: 'sambath.nget@gmail.com',  courseName: 'Blockchain for Developers',          organizationId: 'org-3', organizationName: 'Digital Futures Institute',       issuedAt: '2025-04-08', status: 'issued' },
  { id: 'cert-026', recipientName: 'Mao Dara',      recipientEmail: 'dara.mao@gmail.com',      courseName: 'Data Analytics with Python',        organizationId: 'org-3', organizationName: 'Digital Futures Institute',       issuedAt: '2025-05-05', status: 'issued' },
  { id: 'cert-027', recipientName: 'Toun Vibol',    recipientEmail: 'vibol.toun@gmail.com',    courseName: 'Cloud Computing Foundations',       organizationId: 'org-3', organizationName: 'Digital Futures Institute',       issuedAt: '2025-05-22', status: 'issued' },
  { id: 'cert-028', recipientName: 'Sorn Dara',     recipientEmail: 'dara.sorn@gmail.com',     courseName: 'Network Security Basics',           organizationId: 'org-3', organizationName: 'Digital Futures Institute',       issuedAt: '2025-06-08', status: 'issued' },
  { id: 'cert-029', recipientName: 'Phon Kimleng',  recipientEmail: 'kimleng.phon@gmail.com',  courseName: 'Mobile App Development',            organizationId: 'org-3', organizationName: 'Digital Futures Institute',       issuedAt: '2025-06-25', status: 'issued' },
  { id: 'cert-030', recipientName: 'Ke Vuthy',      recipientEmail: 'vuthy.ke@gmail.com',      courseName: 'UX Design Principles',              organizationId: 'org-3', organizationName: 'Digital Futures Institute',       issuedAt: '2025-07-05', status: 'issued' },
  // org-4: LICA Professionals Association
  { id: 'cert-031', recipientName: 'Pov Sokha',     recipientEmail: 'sokha.pov@gmail.com',     courseName: 'Project Management Essentials',     organizationId: 'org-4', organizationName: 'LICA Professionals Association',  issuedAt: '2025-03-15', status: 'issued' },
  { id: 'cert-032', recipientName: 'Kuch Sreynich', recipientEmail: 'sreynich.kuch@gmail.com', courseName: 'English Communication',             organizationId: 'org-4', organizationName: 'LICA Professionals Association',  issuedAt: '2025-04-20', status: 'issued' },
  { id: 'cert-033', recipientName: 'Kem Sothun',    recipientEmail: 'sothun.kem@gmail.com',    courseName: 'Digital Marketing Strategy',        organizationId: 'org-4', organizationName: 'LICA Professionals Association',  issuedAt: '2025-05-12', status: 'issued' },
  { id: 'cert-034', recipientName: 'Pov Sokha',     recipientEmail: 'sokha.pov@gmail.com',     courseName: 'Blockchain for Developers',          organizationId: 'org-4', organizationName: 'LICA Professionals Association',  issuedAt: '2025-06-10', status: 'issued' },
  { id: 'cert-035', recipientName: 'Iv Rathana',    recipientEmail: 'rathana.iv@gmail.com',    courseName: 'Network Security Basics',           organizationId: 'org-4', organizationName: 'LICA Professionals Association',  issuedAt: '2025-07-02', status: 'issued' },
  // org-5: ASEAN Skills Summit 2025
  { id: 'cert-036', recipientName: 'Ros Dina',      recipientEmail: 'dina.ros@gmail.com',      courseName: 'Digital Transformation Leadership', organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025',        issuedAt: '2025-06-05', status: 'issued' },
  { id: 'cert-037', recipientName: 'Mouk Sreylin',  recipientEmail: 'sreylin.mouk@gmail.com',  courseName: 'Digital Transformation Leadership', organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025',        issuedAt: '2025-06-05', status: 'issued' },
  { id: 'cert-038', recipientName: 'Chom Rachana',  recipientEmail: 'rachana.chom@gmail.com',  courseName: 'ASEAN Business Communication',       organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025',        issuedAt: '2025-06-06', status: 'issued' },
  { id: 'cert-039', recipientName: 'Pich Rithy',    recipientEmail: 'rithy.pich@gmail.com',    courseName: 'ASEAN Business Communication',       organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025',        issuedAt: '2025-06-06', status: 'revoked', revokedAt: '2025-06-20' },
  // org-6: Mekong Coding Academy (suspended)
  { id: 'cert-040', recipientName: 'Hy Daro',       recipientEmail: 'daro.hy@gmail.com',       courseName: 'Web Development Fundamentals',      organizationId: 'org-6', organizationName: 'Mekong Coding Academy',           issuedAt: '2025-01-15', status: 'issued' },
]

const seedAuditEvents: AuditEvent[] = [
  { id: 'aud-01', timestamp: '2025-07-10T09:15:00Z', actorName: 'Noun Sopheap',    actorEmail: 'sopheap@lica.org.kh',         action: 'certificate.issued',  targetLabel: 'Network Security Basics — Iv Rathana',                organizationId: 'org-4', organizationName: 'LICA Professionals Association' },
  { id: 'aud-02', timestamp: '2025-07-08T14:30:00Z', actorName: 'Keo Ratanak',     actorEmail: 'ratanak@dfi.kh',              action: 'certificate.issued',  targetLabel: 'UX Design Principles — Ke Vuthy',                     organizationId: 'org-3', organizationName: 'Digital Futures Institute' },
  { id: 'aud-03', timestamp: '2025-07-05T11:00:00Z', actorName: 'Vuth Pisey',      actorEmail: 'pisey@pnc.org',               action: 'certificate.revoked', targetLabel: 'Blockchain for Developers — Sok Panha',               organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia' },
  { id: 'aud-04', timestamp: '2025-07-01T10:45:00Z', actorName: 'Vuth Pisey',      actorEmail: 'pisey@pnc.org',               action: 'certificate.issued',  targetLabel: 'Blockchain for Developers — Sok Panha',               organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia' },
  { id: 'aud-05', timestamp: '2025-06-25T13:20:00Z', actorName: 'Keo Ratanak',     actorEmail: 'ratanak@dfi.kh',              action: 'certificate.issued',  targetLabel: 'Mobile App Development — Phon Kimleng',               organizationId: 'org-3', organizationName: 'Digital Futures Institute' },
  { id: 'aud-06', timestamp: '2025-06-20T09:00:00Z', actorName: 'Tep Chanthy',     actorEmail: 'chanthy@asean2025skills.org', action: 'certificate.revoked', targetLabel: 'ASEAN Business Communication — Pich Rithy',           organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025' },
  { id: 'aud-07', timestamp: '2025-06-15T15:10:00Z', actorName: 'Chan Sothea',     actorEmail: 'sothea@rppu.edu.kh',          action: 'certificate.issued',  targetLabel: 'Mobile App Development — Nak Piseth',                 organizationId: 'org-1', organizationName: 'Royal Phnom Penh University' },
  { id: 'aud-08', timestamp: '2025-06-10T10:30:00Z', actorName: 'Noun Sopheap',    actorEmail: 'sopheap@lica.org.kh',         action: 'certificate.issued',  targetLabel: 'Blockchain for Developers — Pov Sokha',               organizationId: 'org-4', organizationName: 'LICA Professionals Association' },
  { id: 'aud-09', timestamp: '2025-06-06T09:00:00Z', actorName: 'Tep Chanthy',     actorEmail: 'chanthy@asean2025skills.org', action: 'certificate.issued',  targetLabel: 'ASEAN Business Communication — Chom Rachana',         organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025' },
  { id: 'aud-10', timestamp: '2025-06-05T08:45:00Z', actorName: 'Tep Chanthy',     actorEmail: 'chanthy@asean2025skills.org', action: 'certificate.issued',  targetLabel: 'Digital Transformation Leadership — Ros Dina',        organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025' },
  { id: 'aud-11', timestamp: '2025-06-03T14:00:00Z', actorName: 'Morn Chanveasna', actorEmail: 'chanveasna@rppu.edu.kh',      action: 'certificate.issued',  targetLabel: 'Network Security Basics — Chan Sokha',                organizationId: 'org-1', organizationName: 'Royal Phnom Penh University' },
  { id: 'aud-12', timestamp: '2025-06-02T11:15:00Z', actorName: 'Lim Sokha',       actorEmail: 'sokha.admin@pnc.org',         action: 'certificate.issued',  targetLabel: 'Project Management Essentials — Heng Bopha',          organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia' },
  { id: 'aud-13', timestamp: '2025-05-22T10:00:00Z', actorName: 'Keo Ratanak',     actorEmail: 'ratanak@dfi.kh',              action: 'certificate.issued',  targetLabel: 'Cloud Computing Foundations — Toun Vibol',            organizationId: 'org-3', organizationName: 'Digital Futures Institute' },
  { id: 'aud-14', timestamp: '2025-05-20T09:30:00Z', actorName: 'Lim Sokha',       actorEmail: 'sokha.admin@pnc.org',         action: 'certificate.issued',  targetLabel: 'Cloud Computing Foundations — Lim Sreymom',           organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia' },
  { id: 'aud-15', timestamp: '2025-05-15T14:00:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'org.suspended',       targetLabel: 'Mekong Coding Academy',                               organizationId: 'org-6', organizationName: 'Mekong Coding Academy' },
  { id: 'aud-16', timestamp: '2025-05-15T13:45:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'issuer.removed',      targetLabel: 'Sok Vanna (vanna@mca.edu.kh)',                        organizationId: 'org-6', organizationName: 'Mekong Coding Academy' },
  { id: 'aud-17', timestamp: '2025-05-12T11:00:00Z', actorName: 'Noun Sopheap',    actorEmail: 'sopheap@lica.org.kh',         action: 'certificate.issued',  targetLabel: 'Digital Marketing Strategy — Kem Sothun',             organizationId: 'org-4', organizationName: 'LICA Professionals Association' },
  { id: 'aud-18', timestamp: '2025-05-10T09:00:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'issuer.invited',      targetLabel: 'Tep Chanthy (chanthy@asean2025skills.org)',           organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025' },
  { id: 'aud-19', timestamp: '2025-05-10T08:30:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'org.created',         targetLabel: 'ASEAN Skills Summit 2025',                            organizationId: 'org-5', organizationName: 'ASEAN Skills Summit 2025' },
  { id: 'aud-20', timestamp: '2025-04-15T10:00:00Z', actorName: 'Chan Sothea',     actorEmail: 'sothea@rppu.edu.kh',          action: 'certificate.revoked', targetLabel: 'Cloud Computing Foundations — Sok Chanthy',           organizationId: 'org-1', organizationName: 'Royal Phnom Penh University' },
  { id: 'aud-21', timestamp: '2025-04-08T11:30:00Z', actorName: 'Keo Ratanak',     actorEmail: 'ratanak@dfi.kh',              action: 'certificate.issued',  targetLabel: 'Blockchain for Developers — Nget Sambath',            organizationId: 'org-3', organizationName: 'Digital Futures Institute' },
  { id: 'aud-22', timestamp: '2025-03-25T14:00:00Z', actorName: 'Noun Sopheap',    actorEmail: 'sopheap@lica.org.kh',         action: 'certificate.issued',  targetLabel: 'English Communication — Kuch Sreynich',               organizationId: 'org-4', organizationName: 'LICA Professionals Association' },
  { id: 'aud-23', timestamp: '2025-02-25T09:00:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'issuer.invited',      targetLabel: 'Noun Sopheap (sopheap@lica.org.kh)',                  organizationId: 'org-4', organizationName: 'LICA Professionals Association' },
  { id: 'aud-24', timestamp: '2025-02-22T10:30:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'org.created',         targetLabel: 'LICA Professionals Association',                       organizationId: 'org-4', organizationName: 'LICA Professionals Association' },
  { id: 'aud-25', timestamp: '2025-01-10T09:00:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'issuer.invited',      targetLabel: 'Keo Ratanak (ratanak@dfi.kh)',                        organizationId: 'org-3', organizationName: 'Digital Futures Institute' },
  { id: 'aud-26', timestamp: '2025-01-08T08:00:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'org.created',         targetLabel: 'Digital Futures Institute',                            organizationId: 'org-3', organizationName: 'Digital Futures Institute' },
  { id: 'aud-27', timestamp: '2024-11-05T14:00:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'issuer.invited',      targetLabel: 'Sok Vanna (vanna@mca.edu.kh)',                        organizationId: 'org-6', organizationName: 'Mekong Coding Academy' },
  { id: 'aud-28', timestamp: '2024-11-03T10:00:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'org.created',         targetLabel: 'Mekong Coding Academy',                               organizationId: 'org-6', organizationName: 'Mekong Coding Academy' },
  { id: 'aud-29', timestamp: '2024-10-17T09:30:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'issuer.invited',      targetLabel: 'Vuth Pisey (pisey@pnc.org)',                          organizationId: 'org-2', organizationName: 'Passerelles Numériques Cambodia' },
  { id: 'aud-30', timestamp: '2024-09-02T08:00:00Z', actorName: 'Rasy K',          actorEmail: 'rasy@verify.app',             action: 'issuer.invited',      targetLabel: 'Chan Sothea (sothea@rppu.edu.kh)',                    organizationId: 'org-1', organizationName: 'Royal Phnom Penh University' },
]

// ─── Utilities ─────────────────────────────────────────────────────────────────

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor(diff / 60000)
  if (days > 30) return formatDate(isoDate)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  'certificate.issued':  'Certificate issued',
  'certificate.revoked': 'Certificate revoked',
  'issuer.invited':      'Issuer invited',
  'issuer.removed':      'Issuer removed',
  'org.created':         'Organization created',
  'org.suspended':       'Organization suspended',
}

export const ACTION_META: Record<AuditAction, { icon: string; tint: string }> = {
  'certificate.issued':  { icon: 'i-heroicons-document-check',      tint: 'green' },
  'certificate.revoked': { icon: 'i-heroicons-x-circle',            tint: 'red'   },
  'issuer.invited':      { icon: 'i-heroicons-user-plus',           tint: 'blue'  },
  'issuer.removed':      { icon: 'i-heroicons-user-minus',          tint: 'amber' },
  'org.created':         { icon: 'i-heroicons-building-office-2',   tint: 'green' },
  'org.suspended':       { icon: 'i-heroicons-no-symbol',           tint: 'red'   },
}

// ─── Composable ─────────────────────────────────────────────────────────────────

export function useAdminMockData() {
  const orgs        = useState<Org[]>('admin:orgs',   () => JSON.parse(JSON.stringify(seedOrgs)))
  const users       = useState<AdminUser[]>('admin:users',  () => JSON.parse(JSON.stringify(seedUsers)))
  const certs       = useState<AdminCert[]>('admin:certs',  () => JSON.parse(JSON.stringify(seedCerts)))
  const auditEvents = useState<AuditEvent[]>('admin:audit', () => JSON.parse(JSON.stringify(seedAuditEvents)))

  const totalOrgs          = computed(() => orgs.value.length)
  const totalCerts         = computed(() => certs.value.length)
  const activeIssuers      = computed(() => users.value.filter(u => u.role === 'issuer' && u.status === 'active').length)
  const verificationsLast30 = 247

  const monthlyCerts = [
    { month: 'Feb', count: 12 },
    { month: 'Mar', count: 19 },
    { month: 'Apr', count: 8  },
    { month: 'May', count: 31 },
    { month: 'Jun', count: 24 },
    { month: 'Jul', count: 17 },
  ]

  function pushAudit(event: Omit<AuditEvent, 'id' | 'timestamp' | 'actorName' | 'actorEmail'>) {
    auditEvents.value.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: 'Rasy K',
      actorEmail: 'rasy@verify.app',
      ...event,
    })
  }

  function revokeCert(id: string) {
    const cert = certs.value.find(c => c.id === id)
    if (!cert || cert.status === 'revoked') return
    cert.status = 'revoked'
    cert.revokedAt = new Date().toISOString()
    pushAudit({ action: 'certificate.revoked', targetLabel: `${cert.courseName} — ${cert.recipientName}`, organizationId: cert.organizationId, organizationName: cert.organizationName })
  }

  function suspendOrg(id: string) {
    const org = orgs.value.find(o => o.id === id)
    if (!org || org.status === 'suspended') return
    org.status = 'suspended'
    pushAudit({ action: 'org.suspended', targetLabel: org.name, organizationId: org.id, organizationName: org.name })
  }

  function reactivateOrg(id: string) {
    const org = orgs.value.find(o => o.id === id)
    if (org) org.status = 'active'
  }

  function deactivateUser(id: string) {
    const user = users.value.find(u => u.id === id)
    if (user) user.status = 'deactivated'
  }

  return {
    orgs, users, certs, auditEvents,
    totalOrgs, totalCerts, activeIssuers, verificationsLast30, monthlyCerts,
    revokeCert, suspendOrg, reactivateOrg, deactivateUser,
  }
}
