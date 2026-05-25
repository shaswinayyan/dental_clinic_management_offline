import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox:        'w-full',
          card:           'shadow-lg rounded-xl border border-border',
          headerTitle:    'text-text-primary font-semibold',
          formButtonPrimary: 'bg-brand-600 hover:bg-brand-700 text-white',
        },
      }}
    />
  )
}
