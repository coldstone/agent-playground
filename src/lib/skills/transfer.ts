/**
 * Serialization of skills for the app-data export/import file.
 *
 * Text files travel inline; binaries are base64 so the whole export stays one JSON document.
 */
import { Skill, SkillFileRecord } from '@/types'

/** A SkillFileRecord without the Blob: binaries carry `base64` instead. */
export interface SerializedSkillFile {
  id: string
  skillId: string
  path: string
  size: number
  mimeType: string
  isText: boolean
  text?: string
  base64?: string
}

export interface SkillExportPayload {
  skills: Skill[]
  skillFiles: SerializedSkillFile[]
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000 // Avoid blowing the argument limit of String.fromCharCode on big files
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length))
    binary += String.fromCharCode.apply(null, Array.prototype.slice.call(slice))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Turn stored file records into JSON-safe ones. */
export async function serializeSkillFiles(files: SkillFileRecord[]): Promise<SerializedSkillFile[]> {
  const result: SerializedSkillFile[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const base: SerializedSkillFile = {
      id: file.id,
      skillId: file.skillId,
      path: file.path,
      size: file.size,
      mimeType: file.mimeType,
      isText: file.isText
    }

    if (file.isText) {
      base.text = file.text || ''
    } else if (file.blob) {
      const buffer = await file.blob.arrayBuffer()
      base.base64 = bytesToBase64(new Uint8Array(buffer))
    }

    result.push(base)
  }

  return result
}

/** Rebuild storable records from the export file. */
export function deserializeSkillFiles(files: SerializedSkillFile[]): SkillFileRecord[] {
  return (files || []).map((file) => {
    const record: SkillFileRecord = {
      id: file.id,
      skillId: file.skillId,
      path: file.path,
      size: file.size,
      mimeType: file.mimeType,
      isText: file.isText
    }

    if (file.isText) {
      record.text = file.text || ''
    } else if (file.base64) {
      record.blob = new Blob([base64ToBytes(file.base64)], { type: file.mimeType })
    }

    return record
  })
}
