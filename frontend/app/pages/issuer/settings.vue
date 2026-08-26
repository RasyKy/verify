<script setup lang="ts">
import {
  removeOrgLogo,
  removeOrgSignature,
  updateOrganizationSettings,
  uploadOrgLogo,
  uploadOrgSignature,
  useOrganizationSettings,
} from '~/composables/useOrganizationSettings'

definePageMeta({ layout: 'issuer' })

const { organization, pending, refresh, error } = useOrganizationSettings()
const toast = useToast()

const loadError = computed(() =>
  error.value ? apiErrorMessage(error.value, 'Could not load organization settings') : null,
)

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg'])

function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'Must be a PNG or JPG image.'
  if (file.size > MAX_IMAGE_BYTES) return 'Must be 2MB or smaller.'
  return null
}

const logoBusy = ref(false)
const signatureBusy = ref(false)

async function onUploadLogo(file: File) {
  const problem = validateImage(file)
  if (problem) {
    toast.add({ title: 'Could not use this file', description: problem, color: 'error' })
    return
  }
  logoBusy.value = true
  try {
    await uploadOrgLogo(file)
    await refresh()
    toast.add({ title: 'Logo updated', color: 'success' })
  } catch (err: unknown) {
    toast.add({ title: 'Could not upload logo', description: apiErrorMessage(err), color: 'error' })
  } finally {
    logoBusy.value = false
  }
}

async function onRemoveLogo() {
  logoBusy.value = true
  try {
    await removeOrgLogo()
    await refresh()
    toast.add({ title: 'Logo removed', color: 'success' })
  } catch (err: unknown) {
    toast.add({ title: 'Could not remove logo', description: apiErrorMessage(err), color: 'error' })
  } finally {
    logoBusy.value = false
  }
}

async function onUploadSignature(file: File) {
  const problem = validateImage(file)
  if (problem) {
    toast.add({ title: 'Could not use this file', description: problem, color: 'error' })
    return
  }
  signatureBusy.value = true
  try {
    await uploadOrgSignature(file)
    await refresh()
    toast.add({ title: 'Signature updated', color: 'success' })
  } catch (err: unknown) {
    toast.add({ title: 'Could not upload signature', description: apiErrorMessage(err), color: 'error' })
  } finally {
    signatureBusy.value = false
  }
}

async function onRemoveSignature() {
  signatureBusy.value = true
  try {
    await removeOrgSignature()
    await refresh()
    toast.add({ title: 'Signature removed', color: 'success' })
  } catch (err: unknown) {
    toast.add({ title: 'Could not remove signature', description: apiErrorMessage(err), color: 'error' })
  } finally {
    signatureBusy.value = false
  }
}

/**
 * Signatory name/title save together, on demand — unlike the images, which
 * take effect the moment they're uploaded. Local form state is seeded from
 * the loaded organization and re-seeded whenever it refreshes, so a save
 * doesn't clobber a field the user hasn't touched.
 *
 * Certificate template choice lives on /issuer/courses instead — it's a
 * per-course setting, not an organization-wide one.
 */
const form = reactive({
  signatoryName: '',
  signatoryTitle: '',
})

watch(
  organization,
  (org) => {
    if (!org) return
    form.signatoryName = org.signatoryName ?? ''
    form.signatoryTitle = org.signatoryTitle ?? ''
  },
  { immediate: true },
)

const savingDetails = ref(false)

async function saveDetails() {
  savingDetails.value = true
  try {
    await updateOrganizationSettings({
      signatoryName: form.signatoryName,
      signatoryTitle: form.signatoryTitle,
    })
    await refresh()
    toast.add({ title: 'Certificate settings saved', color: 'success' })
  } catch (err: unknown) {
    toast.add({ title: 'Could not save', description: apiErrorMessage(err), color: 'error' })
  } finally {
    savingDetails.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold page-title">Certificate settings</h1>
      <p class="text-sm mt-1 page-subtitle">
        Your logo, signature, and signatory appear on every certificate document
        recipients download — purely presentational, with no effect on verification.
        To choose which template a course uses, see
        <NuxtLink to="/issuer/courses" class="text-link">Courses</NuxtLink>.
      </p>
    </div>

    <UAlert
      v-if="loadError"
      class="mb-4"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-triangle"
      title="Could not load organization settings"
      :description="loadError"
    />

    <div v-if="!pending && organization" class="space-y-6">
      <!-- Logo + signature -->
      <div class="settings-card">
        <h2 class="card-title">Branding images</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
          <div>
            <p class="field-label">Logo</p>
            <div class="asset-row">
              <div class="asset-thumb">
                <img v-if="organization.logoUrl" :src="organization.logoUrl" alt="" class="asset-image" />
                <UIcon v-else name="i-heroicons-building-library" class="size-6" />
              </div>
              <div class="asset-actions">
                <UFileUpload
                  :model-value="null"
                  accept="image/png,image/jpeg"
                  variant="button"
                  :multiple="false"
                  :preview="false"
                  :reset="true"
                  size="sm"
                  color="neutral"
                  :label="organization.logoUrl ? 'Replace' : 'Upload logo'"
                  icon="i-heroicons-arrow-up-tray"
                  :disabled="logoBusy"
                  @update:model-value="(file) => file && onUploadLogo(file as File)"
                />
                <UButton
                  v-if="organization.logoUrl"
                  variant="ghost"
                  color="error"
                  size="sm"
                  icon="i-heroicons-trash"
                  :loading="logoBusy"
                  aria-label="Remove logo"
                  @click="onRemoveLogo"
                />
              </div>
            </div>
          </div>

          <div>
            <p class="field-label">Signatory's signature</p>
            <div class="asset-row">
              <div class="asset-thumb">
                <img v-if="organization.signatureUrl" :src="organization.signatureUrl" alt="" class="asset-image" />
                <UIcon v-else name="i-heroicons-pencil" class="size-6" />
              </div>
              <div class="asset-actions">
                <UFileUpload
                  :model-value="null"
                  accept="image/png,image/jpeg"
                  variant="button"
                  :multiple="false"
                  :preview="false"
                  :reset="true"
                  size="sm"
                  color="neutral"
                  :label="organization.signatureUrl ? 'Replace' : 'Upload signature'"
                  icon="i-heroicons-arrow-up-tray"
                  :disabled="signatureBusy"
                  @update:model-value="(file) => file && onUploadSignature(file as File)"
                />
                <UButton
                  v-if="organization.signatureUrl"
                  variant="ghost"
                  color="error"
                  size="sm"
                  icon="i-heroicons-trash"
                  :loading="signatureBusy"
                  aria-label="Remove signature"
                  @click="onRemoveSignature"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Signatory -->
      <div class="settings-card">
        <h2 class="card-title">Signatory</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <UFormField name="signatoryName" label="Name">
            <UInput v-model="form.signatoryName" placeholder="Dr. Sok Dara" class="w-full" />
          </UFormField>
          <UFormField name="signatoryTitle" label="Title">
            <UInput v-model="form.signatoryTitle" placeholder="Dean" class="w-full" />
          </UFormField>
        </div>

        <div class="mt-6">
          <UButton :loading="savingDetails" @click="saveDetails">Save changes</UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-title { color: var(--text-primary); }
.page-subtitle { color: var(--text-secondary); }
.text-link { color: var(--accent); text-decoration: underline; }

.settings-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  padding: 20px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.field-label {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.asset-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.asset-thumb {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--surface-hover);
  color: var(--text-tertiary);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.asset-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}

.asset-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
