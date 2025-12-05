import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdateNotificationComponent } from "./update-notification/update-notification.component/update-notification";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdateNotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
