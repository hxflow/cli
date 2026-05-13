import { uuidv7 } from "@hxflow/shared/uuid"

export function newRunId(): string {
  return uuidv7()
}
