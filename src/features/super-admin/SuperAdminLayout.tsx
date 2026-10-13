import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { SidebarShell, type NavItem } from '@/components/SidebarShell'
import { IconBriefcase, IconClipboard, IconHome, IconShield, IconUser } from '@/components/icons/NavIcons'

const NAV_ITEMS: NavItem[] = [
  { to: '/super-admin', label: 'Dashboard', end: true, icon: IconHome },
  { to: '/super-admin/negocios', label: 'Negocios', end: false, icon: IconBriefcase },
  { to: '/super-admin/usuarios', label: 'Usuarios', end: false, icon: IconUser },
  { to: '/super-admin/auditoria', label: 'Auditoría', end: false, icon: IconClipboard },
  { to: '/super-admin/seguridad', label: 'Mi seguridad', end: false, icon: IconShield },
]

export function SuperAdminLayout() {
  const { session, signOut } = useAuth()

  return (
    <SidebarShell
      navItems={NAV_ITEMS}
      header={
        <>
          <span className="truncate text-lg font-semibold text-brand-100">OídoChef</span>
          <p className="mt-1.5 truncate text-xs text-neutral-400">Panel de Super Admin</p>
        </>
      }
      footerDetail={<p className="hidden truncate text-neutral-400 md:block">{session?.user?.email}</p>}
      accountDetail={<p className="truncate px-1 pb-2 text-xs text-neutral-500">{session?.user?.email}</p>}
      onSignOut={() => void signOut()}
    >
      <Outlet />
    </SidebarShell>
  )
}
