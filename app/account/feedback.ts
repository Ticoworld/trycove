"use server";
import {isRedirectError} from 'next/dist/client/components/redirect-error';
import {logout} from './actions';
import {startClaim, verifyClaim, reviewClaim, revokeClaim, manageMaintainer} from './claims';
async function run(action: (form: FormData) => Promise<void>, form: FormData) {
  try { await action(form); return ''; } catch (error) {
    if (isRedirectError(error)) throw error;
    const safe = ['That account already has access.', 'No maintainer was found for that account.', 'Choose an existing Product Passport.', 'The challenge was not found on the default branch.', 'This project already has an owner. An organizer must resolve the existing claim first.'];
    return error instanceof Error && safe.includes(error.message) ? error.message : 'Could not complete this action. Check the details and try again.';
  }
}
export async function claimAction(_: string, form: FormData) { return run(startClaim, form); }
export async function verifyAction(_: string, form: FormData) { return run(verifyClaim, form); }
export async function reviewAction(_: string, form: FormData) { return run(reviewClaim, form); }
export async function revokeAction(_: string, form: FormData) { return run(revokeClaim, form); }
export async function maintainerAction(_: string, form: FormData) { return run(manageMaintainer, form); }
export async function logoutAction(_: string, form: FormData) { return run(logout, form); }
