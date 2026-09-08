'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity01Icon,
  Globe02Icon,
  LayoutDashboardIcon,
  Leaf01Icon,
  Logout01Icon,
  Medicine01Icon,
  Plant01Icon,
  UserCircleIcon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons';
import Icon from './Icon';
import { useAuth } from '@/lib/auth-context';
import { canAudit, canManageUsers } from '@/lib/permissions';

// Deep green header with a pale mint active row.
const HEADER_GREEN = '#2F5A48';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboardIcon;
  matchPrefix?: string;
  excludePrefix?: string;
};

const mainMenuItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboardIcon,
  },
  {
    href: '/herbal-medicines',
    label: 'Herbal Medicines',
    icon: Leaf01Icon,
    matchPrefix: '/herbal-medicines',
  },
  {
    href: '/herbs',
    label: 'Herb Catalog',
    icon: Plant01Icon,
    matchPrefix: '/herbs',
    excludePrefix: '/herbs/discover',
  },
  {
    href: '/herbs/discover',
    label: 'Discover Herbs',
    icon: Globe02Icon,
  },
  {
    href: '/interactions',
    label: 'Interactions',
    icon: Medicine01Icon,
    matchPrefix: '/interactions',
  },
];

function isItemActive(item: NavItem, pathname: string) {
  const matchPrefix = item.matchPrefix || item.href;
  return (
    pathname === item.href ||
    (pathname.startsWith(`${matchPrefix}/`) &&
      !(item.excludePrefix && pathname.startsWith(item.excludePrefix)))
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isItemActive(item, pathname);

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center gap-3.5 px-5 py-3.5 text-base transition-colors duration-150 ${
        active
          ? 'bg-[#EAF4EC] font-semibold text-[#2F5A48] hover:bg-[#E0EFE5]'
          : 'font-normal text-gray-700 hover:bg-[#F3F9F5] hover:text-[#2F5A48]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-[3px] transition-opacity duration-150 ${
          active
            ? 'bg-[#2F5A48] opacity-100'
            : 'bg-[#2F5A48] opacity-0 group-hover:opacity-100'
        }`}
      />
      <span className="shrink-0">
        <Icon icon={item.icon} size={24} />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { permissions, profile, signOut } = useAuth();

  const items: NavItem[] = [
    ...mainMenuItems,
    ...(canAudit(permissions)
      ? [
          {
            href: '/activity-log',
            label: 'Activity Log',
            icon: Activity01Icon,
          } satisfies NavItem,
        ]
      : []),
    ...(canManageUsers(profile)
      ? [
          {
            href: '/settings/users',
            label: 'Users',
            icon: UserMultipleIcon,
          } satisfies NavItem,
        ]
      : []),
    {
      href: '/settings/account',
      label: 'Account',
      icon: UserCircleIcon,
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col overflow-hidden border-r border-gray-200 bg-white print:hidden">
      <div
        className="flex h-14 shrink-0 items-center gap-3.5 px-5"
        style={{ backgroundColor: HEADER_GREEN }}
      >
        <span aria-hidden="true" className="flex items-center gap-[3.5px]">
          <span className="h-4 w-[2.5px] rounded-full bg-white/90" />
          <span className="h-4 w-[2.5px] rounded-full bg-white/90" />
          <span className="h-4 w-[2.5px] rounded-full bg-white/90" />
        </span>
        <span className="text-base font-medium text-white">Menu</span>
      </div>

      <nav className="flex flex-1 flex-col overflow-hidden pt-3">
        <div className="flex-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        <div className="shrink-0 border-t border-gray-100 py-1">
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-3.5 px-5 py-3.5 text-base text-gray-700 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
          >
            <span className="shrink-0">
              <Icon icon={Logout01Icon} size={24} />
            </span>
            Logout
          </button>
        </div>
      </nav>
    </aside>
  );
}
