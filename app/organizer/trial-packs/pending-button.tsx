"use client";
import {useFormStatus} from 'react-dom';
export function PendingButton({label, pendingLabel, secondary = false}: {label: string; pendingLabel: string; secondary?: boolean}) {
  const {pending} = useFormStatus();
  return <button className={secondary ? 'button secondary' : 'button'} disabled={pending}>{pending ? pendingLabel : label}</button>;
}
