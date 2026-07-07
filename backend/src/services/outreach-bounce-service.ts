import { addGloballyInvalidEmail } from "../database/global-invalid-email-repository";
import { markDomainEmailDead } from "../database/domain-email-cache-repository";

export async function recordHardBounceForRecipient(params: {
  recipientEmail: string;
  smtpCode?: number | null;
  reason: string;
}): Promise<void> {
  const email = params.recipientEmail.toLowerCase().trim();
  await addGloballyInvalidEmail({
    email,
    smtpCode: params.smtpCode,
    reason: params.reason,
  });
  await markDomainEmailDead({ email });
}
