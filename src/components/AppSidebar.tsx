import {
  Palette,
  Factory,
  DollarSign,
  Truck,
  LayoutDashboard,
  List,
  PlusCircle,
  Database,
  GitCompare,
  ClipboardList,
  ShoppingCart,
  IndianRupee,
  Droplet,
  Users,
  Warehouse,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  PackageCheck,
  Globe2,
  Wrench,
  Boxes,
  ClipboardCheck,
  BookOpenCheck,
  Activity,
} from 'lucide-react';

import { useRole } from '@/context/RoleContext';
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
  { title: 'Compare Lots', url: '/shade-management/compare', icon: GitCompare },
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
  { title: 'Client Rates', url: '/dispatch/client-rates', icon: IndianRupee },
  { title: 'Oil Consumption', url: '/dispatch/oil-consumption', icon: Droplet },
];

const expenseItems = [
  { title: 'All Expenses', url: '/expenses', icon: DollarSign },
  { title: 'New Expense', url: '/expenses/create', icon: PlusCircle },
  { title: 'Item Master', url: '/item-master', icon: Database },
];


const storeItems = [
  { title: 'Dashboard', url: '/store', icon: LayoutDashboard },
  { title: 'Item Master', url: '/store/items', icon: Package },
  { title: 'Stock Inward', url: '/store/stock-inward', icon: ArrowDownToLine },
  { title: 'Internal Issues', url: '/store/internal-issues', icon: ArrowUpFromLine },
  { title: 'Finished Goods', url: '/store/finished-goods', icon: PackageCheck },
  { title: 'External Dyed Yarn', url: '/store/external-dyed-yarn', icon: Globe2 },
  { title: 'Assets', url: '/store/assets', icon: Wrench },
  { title: 'Current Stock', url: '/store/current-stock', icon: Boxes },
  { title: 'Stock Verification', url: '/store/stock-verification', icon: ClipboardCheck },
  { title: 'Stock Ledger', url: '/store/stock-ledger', icon: BookOpenCheck },
  { title: 'Inventory Timeline', url: '/store/timeline', icon: Activity },
];

const modules = [
  { title: 'Production', url: '/production', icon: Factory },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isShadeActive = location.pathname.startsWith('/shade-management');
  const { isViewer, isAdmin } = useRole();

  const writeUrlPatterns = ['/create', '/opening-stock', '/bulk-opening-stock', '/edit', '/receive'];
  const isWriteItem = (url: string) => writeUrlPatterns.some(p => url.includes(p));
  const filterForViewer = <T extends { url: string }>(items: T[]) =>
    isViewer ? items.filter(i => !isWriteItem(i.url)) : items;

  const shade = filterForViewer(shadeItems);
  const sampling = filterForViewer(samplingItems);
  const dispatch = filterForViewer(dispatchItems);
  const expense = filterForViewer(expenseItems);
  const store = filterForViewer(storeItems);


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
              {shade.map((item) => (
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
              {sampling.map((item) => (
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
          <SidebarGroupLabel>
            <Truck className="mr-2 h-4 w-4" />
            {!collapsed && 'Dispatch'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dispatch.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dispatch'}
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
            <DollarSign className="mr-2 h-4 w-4" />
            {!collapsed && 'Expenses'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {expense.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/expenses'}
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
            <Warehouse className="mr-2 h-4 w-4" />
            {!collapsed && 'Store Management'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {store.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/store'}
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

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Users className="mr-2 h-4 w-4" />
              {!collapsed && 'Administration'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/users" className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <Users className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Users & Roles</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/activity" className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <Activity className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Activity Center</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
