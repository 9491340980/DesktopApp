
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { IosManagement } from "../../ios-management/ios-management";


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    IosManagement
],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login  {

}
