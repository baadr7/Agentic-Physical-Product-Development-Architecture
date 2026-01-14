import { Home, User, Folder, PlusCircle, ActivitySquare } from 'lucide-react';
import { z } from 'zod';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import pathsConfig from '~/config/paths.config';

const iconClasses = 'w-4';

const routes = [
  {
    label: 'Navigation',
    children: [
      {
        label: 'Vision globale',
        path: pathsConfig.app.home,
        Icon: <Home className={iconClasses} />,
        end: true,
      },
    ],
  },
  {
    label: 'Projets',
    children: [
      {
        label: 'Tous les projets',
        path: '/projects',
        Icon: <Folder className={iconClasses} />,
        end: true,
      },
      {
        label: 'Créer un projet',
        path: '/projects/create',
        Icon: <PlusCircle className={iconClasses} />,
        end: true,
      },
      {
        label: 'Runs',
        path: '/dashboard/runs',
        Icon: <ActivitySquare className={iconClasses} />,
        end: true,
      },
    ],
  },
  {
    label: 'Paramètres',
    children: [
      {
        label: 'Profil',
        path: pathsConfig.app.profileSettings,
        Icon: <User className={iconClasses} />,
      },
    ],
  },
] satisfies z.infer<typeof NavigationConfigSchema>['routes'];

export const navigationConfig = NavigationConfigSchema.parse({
  routes,
  style: process.env.NEXT_PUBLIC_NAVIGATION_STYLE,
  sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
});
