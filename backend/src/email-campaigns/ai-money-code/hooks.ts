import { logger } from "../../utils/logger";
import { tryEnrollEligibleLicense } from "./enrollment";

/** Safe additive hook after license activation; never throws to caller. */
export async function onLicenseActivatedForCampaign(input: {
  licenseId: string;
  email: string;
}): Promise<void> {
  try {
    const result = await tryEnrollEligibleLicense(input);
    if (result === "enrolled") {
      logger.info("AI money code enrolled recipient on license activation", {
        licenseId: input.licenseId,
      });
    }
  } catch (err) {
    logger.error("AI money code enrollment hook failed", {
      licenseId: input.licenseId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
