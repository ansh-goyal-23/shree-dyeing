import {
  Palette,
  Factory,
  DollarSign,
  Truck,
  Package,
  LayoutDashboard,
  List,
  PlusCircle,
  Database,
  ClipboardList,
  ShoppingCart,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const shadeItems = [
  { title: 'Dashboard', url: '/shade-management', icon: LayoutDashboard },
  { title: 'Lot List', url: '/shade-management/lots', icon: List },
  { title: 'Create Lot', url: '/shade-management/lots/create', icon: PlusCircle },
  { title: 'Master Data', url: '/shade-management/master', icon: Database },
];

const samplingItems = [
  { title: 'All Intakes', url: '/sampling', icon: ClipboardList },
  { title: 'New Intake', url: '/sampling/create', icon: PlusCircle },
  { title: 'Direct Order', url: '/sampling/order/create', icon: ShoppingCart },
];

const dispatchItems = [
  { title: 'All Challans', url: '/dispatch', icon: Truck },
  { title: 'New Challan', url: '/dispatch/create', icon: PlusCircle },
];

const modules = [
  { title: 'Production', url: '/production', icon: Factory },
  { title: 'Expenses', url: '/expenses', icon: DollarSign },
  { title: 'Inventory', url: '/inventory', icon: Package },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isShadeActive = location.pathname.startsWith('/shade-management');

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <Palette className="mr-2 h-4 w-4" />
            {!collapsed && 'Shade Management'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {shadeItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/shade-management'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            <ClipboardList className="mr-2 h-4 w-4" />
            {!collapsed && 'Sampling & Orders'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {samplingItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/sampling'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && 'Other Modules'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
