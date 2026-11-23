import {redirect} from 'next/navigation';

export default function AuthComplete() {
  redirect('/account');
}
