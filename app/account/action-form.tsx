"use client";
import {useActionState, type ReactNode} from 'react';
export function ActionForm({action, children, className}: {action: (previous: string, form: FormData) => Promise<string>; children: ReactNode; className?: string}) {
  const [error, submit] = useActionState(action, '');
  return <form action={submit} className={className}>{children}{error && <p role="alert">{error}</p>}</form>;
}
