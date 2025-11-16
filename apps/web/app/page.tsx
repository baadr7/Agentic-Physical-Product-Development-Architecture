import { redirect } from 'next/navigation'

export default function Page() {
  // Redirect root to the dashboard as the first view the user wants to see
  redirect('/dashboard')
}
