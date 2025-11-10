import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Auth } from '../services/auth';

interface MenuItem {
  Title: string;
  OperationId: string;
  Category: string;
  Module: string;
  RouterLink: string;
  HasSubMenu: boolean;
  SubMenu?: SubMenuItem[];
  Icon?: string;
  AppEnabled?: boolean;
}

interface SubMenuItem {
  Title: string;
  OperationId: string;
  Category: string;
  Module: string;
  RouterLink: string;
  AppEnabled: boolean;
  Icon?: string;
}

@Component({
  selector: 'app-dashboard',
 imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatGridListModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  menuItems: MenuItem[] = [];
  filteredMenuItems: MenuItem[] = [];
  searchQuery: string = '';
  username: string = '';
  siteId: string = '';
  selectedModule: MenuItem | null = null;

  constructor(
    private router: Router,
    private authService: Auth
  ) {}

  ngOnInit(): void {
    this.loadUserInfo();
    this.loadMenuItems();
  }


  menuData(){
     return this.menuItems.reduce((acc, item) => acc + (item.SubMenu?.length || 0), 0)
  }
  /**
   * Load user information
   */
  private loadUserInfo(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.username = user.username;
      this.siteId = user.siteId;
    }
  }

  /**
   * Load menu items from localStorage
   */
  private loadMenuItems(): void {
    const menuStr = localStorage.getItem('menu');

    if (menuStr) {
      try {
        this.menuItems = JSON.parse(menuStr);
        this.filteredMenuItems = [...this.menuItems];

        // Add default icons if not present
        this.menuItems.forEach(item => {
          if (!item.Icon) {
            item.Icon = this.getDefaultIcon(item.Module || item.Title);
          }

          if (item.SubMenu) {
            item.SubMenu.forEach(subItem => {
              if (!subItem.Icon) {
                subItem.Icon = this.getDefaultSubMenuIcon(subItem.Title);
              }
            });
          }
        });
      } catch (error) {
        console.error('Error parsing menu from localStorage:', error);
        this.menuItems = [];
        this.filteredMenuItems = [];
      }
    }
  }

  /**
   * Get default icon based on module/title
   */
  private getDefaultIcon(moduleOrTitle: string): string {
    const iconMap: { [key: string]: string } = {
      'RCV': 'inbox',
      'RECEIVING': 'inbox',
      'PUT': 'archive',
      'PUTAWAY': 'archive',
      'PICK': 'shopping_cart',
      'PICKING': 'shopping_cart',
      'SHIP': 'local_shipping',
      'SHIPPING': 'local_shipping',
      'INV': 'inventory_2',
      'INVENTORY': 'inventory_2',
      'QA': 'verified',
      'QUALITY': 'verified',
      'ADMIN': 'admin_panel_settings',
      'SETTINGS': 'settings',
      'REPORTS': 'assessment',
      'UTILITIES': 'build',
      'MAINTENANCE': 'construction'
    };

    const key = moduleOrTitle.toUpperCase();
    return iconMap[key] || 'widgets';
  }

  /**
   * Get default icon for sub-menu items
   */
  private getDefaultSubMenuIcon(title: string): string {
    const titleUpper = title.toUpperCase();

    if (titleUpper.includes('CREATE') || titleUpper.includes('ADD')) return 'add_circle';
    if (titleUpper.includes('EDIT') || titleUpper.includes('UPDATE')) return 'edit';
    if (titleUpper.includes('DELETE') || titleUpper.includes('REMOVE')) return 'delete';
    if (titleUpper.includes('VIEW') || titleUpper.includes('LIST')) return 'visibility';
    if (titleUpper.includes('SEARCH') || titleUpper.includes('FIND')) return 'search';
    if (titleUpper.includes('REPORT')) return 'description';
    if (titleUpper.includes('PRINT')) return 'print';
    if (titleUpper.includes('EXPORT')) return 'file_download';
    if (titleUpper.includes('IMPORT')) return 'file_upload';

    return 'fiber_manual_record';
  }

  /**
   * Search/filter menu items
   */
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value.toLowerCase();

    if (!this.searchQuery) {
      this.filteredMenuItems = [...this.menuItems];
      return;
    }

    this.filteredMenuItems = this.menuItems.filter(item => {
      // Check main menu
      const mainMatch = item.Title.toLowerCase().includes(this.searchQuery);

      // Check sub-menu
      const subMatch = item.SubMenu?.some(sub =>
        sub.Title.toLowerCase().includes(this.searchQuery)
      );

      return mainMatch || subMatch;
    });
  }

  /**
   * Handle main menu click
   */
  onMainMenuClick(item: MenuItem): void {
    if (item.HasSubMenu) {
      this.selectedModule = this.selectedModule?.OperationId === item.OperationId ? null : item;
    } else {
      this.navigateToModule(item);
    }
  }

  /**
   * Handle sub-menu click
   */
  onSubMenuClick(mainItem: MenuItem, subItem: SubMenuItem): void {
    if (subItem.RouterLink) {
      // Store operation info for the target component
      localStorage.setItem('currentOperation', JSON.stringify({
        operationId: subItem.OperationId,
        module: subItem.Module,
        category: subItem.Category,
        title: subItem.Title
      }));

      this.router.navigate([subItem.RouterLink]);
    }
  }

  /**
   * Navigate to module
   */
  private navigateToModule(item: MenuItem): void {
    if (item.RouterLink) {
      localStorage.setItem('currentOperation', JSON.stringify({
        operationId: item.OperationId,
        module: item.Module,
        category: item.Category,
        title: item.Title
      }));

      this.router.navigate([item.RouterLink]);
    }
  }

  /**
   * Check if menu item is selected
   */
  isModuleSelected(item: MenuItem): boolean {
    return this.selectedModule?.OperationId === item.OperationId;
  }

  /**
   * Get sub-menu items (filtered if searching)
   */
  getFilteredSubMenu(item: MenuItem): SubMenuItem[] {
    if (!item.SubMenu) return [];

    if (!this.searchQuery) {
      return item.SubMenu.filter(sub => sub.AppEnabled !== false);
    }

    return item.SubMenu.filter(sub =>
      sub.AppEnabled !== false &&
      sub.Title.toLowerCase().includes(this.searchQuery)
    );
  }

  /**
   * Get image path for menu item
   */
  getMenuImagePath(item: MenuItem): string {
    return `assets/images/dashboard/${item.Title}.png`;
  }

  /**
   * Get image path for sub-menu item
   */
  getSubMenuImagePath(mainTitle: string, subItem: SubMenuItem): string {
    return `assets/images/dashboard/sub-menu-icons/${subItem.Title}-${subItem.OperationId}.png`;
  }

  /**
   * Handle image error
   */
  onImageError(event: Event, useIcon: boolean = true): void {
    if (useIcon) {
      const img = event.target as HTMLImageElement;
      img.style.display = 'none';
      // Icon will be shown as fallback
    }
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.filteredMenuItems = [...this.menuItems];
  }
}

// Models (keep all your existing interfaces)
interface ClientData {
  Location: string;
  ClientId: string;
  SiteId: string;
  LoggedInUser?: string;
  DeviceId?: string;
  Roles?: string[];
}

interface UIData {
  OperationId?: string;
  OperCategory?: string;
}

interface WindowsService {
  ServiceName: string;
  Description: string;
  Status: string;
  ServerName: string;
  MemoryUtilization: number;
  ThreadCount: number;
  CPUUtilization: number;
  Total_CPU: number;
}

interface TaskScheduler {
  TaskName: string;
  Description: string;
  LastRunTime: string;
  Status: string;
}

interface ApiService {
  WebAPIName: string;
  Status: string;
  Url?: string;
}

interface QueueAlert {
  QueueName: string;
  QueueDesc: string;
  LastHour: number;
  New: number;
  Inprocess: number;
  Error: number;
  Completed: number;
  Color: string;
  Threshold: number;
  LastRun: string;
  QueueType: string;
}

interface ServiceStatistics {
  totalServices: number;
  runningServices: number;
  stoppedServices: number;
  warningServices: number;
}
