import Link from 'next/link';

import { SignInMethodsContainer } from '@kit/auth/sign-in';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signIn'),
  };
};

const paths = {
  callback: pathsConfig.auth.callback,
  home: pathsConfig.app.home,
};

function SignInPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const disabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const issues: string[] = [];
  if (disabled) issues.push('Auth is disabled (NEXT_PUBLIC_DISABLE_AUTH=true).');
  if (!url) issues.push('Missing NEXT_PUBLIC_SUPABASE_URL.');
  if (!anon || anon === 'REPLACE_WITH_ANON_KEY') issues.push('Anon key missing or placeholder.');
  if (!siteUrl) issues.push('NEXT_PUBLIC_SITE_URL not set – email links / redirects may fail.');
  if (siteUrl && siteUrl.startsWith('http://') && process.env.NODE_ENV === 'production') {
    issues.push('Site URL must be HTTPS in production.');
  }

  return (
    <>
      <Heading level={5} className={'tracking-tight'}>
        <Trans i18nKey={'auth:signInHeading'} />
      </Heading>

      {issues.length > 0 && (
        <div className="mt-4 mb-6 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold mb-2">Configuration d'authentification incomplète :</p>
          <ul className="list-disc pl-5 space-y-1">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="mt-3">
            Corrige les variables dans <code>.env.local</code> puis redémarre <code>pnpm dev</code>. Clé anon réelle : Supabase → Settings → API.
          </p>
        </div>
      )}

      <SignInMethodsContainer paths={paths} providers={authConfig.providers} />

      <div className={'flex justify-center'}>
        <Button asChild variant={'link'} size={'sm'}>
          <Link href={pathsConfig.auth.signUp}>
            <Trans i18nKey={'auth:doNotHaveAccountYet'} />
          </Link>
        </Button>
      </div>
    </>
  );
}

export default withI18n(SignInPage);
