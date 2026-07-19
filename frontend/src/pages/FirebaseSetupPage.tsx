import { Link } from 'react-router-dom'

export default function FirebaseSetupPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-xl font-semibold text-stone-900">Firebase setup</h1>
      <p className="mt-2 text-sm text-stone-600">
        The app needs Firebase for real accounts. Follow these steps once — takes about 5 minutes.
      </p>

      <ol className="mt-8 space-y-6 text-sm text-stone-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">1</span>
          <div>
            <p className="font-medium text-stone-900">Create a Firebase project</p>
            <p className="mt-1 text-stone-600">
              Go to{' '}
              <a
                href="https://console.firebase.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-teal-700 underline"
              >
                console.firebase.google.com
              </a>
              , click <strong>Add project</strong>, and finish the wizard.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">2</span>
          <div>
            <p className="font-medium text-stone-900">Enable Email/Password auth</p>
            <p className="mt-1 text-stone-600">
              Build → Authentication → Sign-in method → enable <strong>Email/Password</strong>.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">3</span>
          <div>
            <p className="font-medium text-stone-900">Register a web app</p>
            <p className="mt-1 text-stone-600">
              Project settings → Your apps → Web icon → copy the <code className="rounded bg-stone-200 px-1 text-xs">firebaseConfig</code> values.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">4</span>
          <div>
            <p className="font-medium text-stone-900">Create <code className="rounded bg-stone-200 px-1 text-xs">frontend/.env</code></p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 p-4 text-xs text-stone-100">
{`VITE_FIREBASE_API_KEY=your_key_from_console
VITE_FIREBASE_AUTH_DOMAIN=digital-wellness.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=digital-wellness
VITE_FIREBASE_STORAGE_BUCKET=digital-wellness.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`}
            </pre>
            <p className="mt-2 text-stone-500">Restart <code className="text-xs">npm run dev</code> after saving.</p>
          </div>
        </li>
      </ol>

      <p className="mt-8 text-sm text-stone-600">
        This app requires a real Firebase project — there is no offline or demo mode. Once your{' '}
        <code className="text-xs">.env</code> is set, <Link to="/login" className="font-medium text-teal-700">go to sign in</Link>.
      </p>
    </div>
  )
}
