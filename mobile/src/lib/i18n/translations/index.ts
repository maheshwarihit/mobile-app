import * as common from "./common";
import * as enums from "./enums";
import * as chooseLanguage from "./chooseLanguage";
import * as onboarding from "./onboarding";
import * as landing from "./landing";
import * as home from "./home";
import * as services from "./services";
import * as appointment from "./appointment";
import * as payment from "./payment";
import * as profile from "./profile";
import * as dashboard from "./dashboard";
import * as bookingCard from "./bookingCard";
import * as auth from "./auth";
import * as completeProfile from "./completeProfile";
import * as verifyPhone from "./verifyPhone";
import * as opsShared from "./ops/shared";
import * as opsAppointments from "./ops/appointments";
import * as opsRequests from "./ops/requests";
import * as opsTeam from "./ops/team";
import * as opsClients from "./ops/clients";
import * as opsMyVisits from "./ops/myVisits";
import * as opsProfile from "./ops/profile";
import * as opsReports from "./ops/reports";
import * as opsLiveSheet from "./ops/liveSheet";
import * as opsPaymentProofs from "./ops/paymentProofs";
import * as opsPaymentQr from "./ops/paymentQr";
import * as opsUserDetails from "./ops/userDetails";
import * as modalApproveAssign from "./modals/approveAssign";
import * as modalPaymentReview from "./modals/paymentReview";
import * as modalVitals from "./modals/vitals";
import * as modalReportUpload from "./modals/reportUpload";
import * as modalAdminNote from "./modals/adminNote";
import * as modalNewAppointment from "./modals/newAppointment";
import * as modalDependent from "./modals/dependent";

// Every namespace module exports `en` (the source of truth for which keys
// exist) and `ta` (typed as `Record<keyof typeof en, string>`, so a module
// missing a Tamil entry fails `tsc`, not just silently falls back to English
// at runtime). Merging plain object spreads here loses that per-module
// exhaustiveness check on the *combined* type, but each module already
// self-enforces it — this file just needs the union of keys to exist.
export const en = {
  ...common.en,
  ...enums.en,
  ...chooseLanguage.en,
  ...onboarding.en,
  ...landing.en,
  ...home.en,
  ...services.en,
  ...appointment.en,
  ...payment.en,
  ...profile.en,
  ...dashboard.en,
  ...bookingCard.en,
  ...auth.en,
  ...completeProfile.en,
  ...verifyPhone.en,
  ...opsShared.en,
  ...opsAppointments.en,
  ...opsRequests.en,
  ...opsTeam.en,
  ...opsClients.en,
  ...opsMyVisits.en,
  ...opsProfile.en,
  ...opsReports.en,
  ...opsLiveSheet.en,
  ...opsPaymentProofs.en,
  ...opsPaymentQr.en,
  ...opsUserDetails.en,
  ...modalApproveAssign.en,
  ...modalPaymentReview.en,
  ...modalVitals.en,
  ...modalReportUpload.en,
  ...modalAdminNote.en,
  ...modalNewAppointment.en,
  ...modalDependent.en,
} as const;

export const ta: Record<keyof typeof en, string> = {
  ...common.ta,
  ...enums.ta,
  ...chooseLanguage.ta,
  ...onboarding.ta,
  ...landing.ta,
  ...home.ta,
  ...services.ta,
  ...appointment.ta,
  ...payment.ta,
  ...profile.ta,
  ...dashboard.ta,
  ...bookingCard.ta,
  ...auth.ta,
  ...completeProfile.ta,
  ...verifyPhone.ta,
  ...opsShared.ta,
  ...opsAppointments.ta,
  ...opsRequests.ta,
  ...opsTeam.ta,
  ...opsClients.ta,
  ...opsMyVisits.ta,
  ...opsProfile.ta,
  ...opsReports.ta,
  ...opsLiveSheet.ta,
  ...opsPaymentProofs.ta,
  ...opsPaymentQr.ta,
  ...opsUserDetails.ta,
  ...modalApproveAssign.ta,
  ...modalPaymentReview.ta,
  ...modalVitals.ta,
  ...modalReportUpload.ta,
  ...modalAdminNote.ta,
  ...modalNewAppointment.ta,
  ...modalDependent.ta,
};

export type TranslationKey = keyof typeof en;
