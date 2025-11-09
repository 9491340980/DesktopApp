import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
 imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './unauthorized.html',
  styleUrl: './unauthorized.scss',
})
export class Unauthorized {
message: string = 'You do not have permission to access this page.';
  returnUrl: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Get query parameters
    this.route.queryParams.subscribe((params:any) => {
      this.returnUrl = params['returnUrl'] || '';
      const reason = params['reason'];

      // Set message based on reason
      if (reason === 'insufficient_permissions') {
        this.message = 'You do not have the required permissions to access this page.';
      } else if (reason === 'forbidden') {
        this.message = 'Access to this resource is forbidden.';
      } else if (reason === 'role_required') {
        this.message = 'This page requires specific roles that you do not have.';
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goBack(): void {
    if (this.returnUrl) {
      this.router.navigate([this.returnUrl]);
    } else {
      window.history.back();
    }
  }
}
