import { Injectable } from '@angular/core';
import { forkJoin, Observable, switchMap } from 'rxjs';
import { ApiResponse, ClientData, LoginModel, UserProfile } from '../models/api.models';
import { CommonService } from './common-service';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  constructor(private httpService: CommonService) {}

  /**
   * Get Roles and Site IDs
   */
  getRolesSiteIds(clientData: ClientData, loginModel: LoginModel): Observable<ApiResponse<any>> {
    return this.httpService.post('/LogIn/GetRolesSiteIds', clientData, {
      LogInModel: loginModel
    });
  }

  /**
   * Get User Profile
   */
  getUserProfile(clientData: ClientData, userProfile: Partial<UserProfile>): Observable<ApiResponse<any>> {
    return this.httpService.post('/LogIn/getUserProfile', clientData, {
      UserProfile: userProfile
    });
  }

  /**
   * Get Messages for Category
   */
  getMessagesForCategory(clientData: ClientData, category: string = 'COM'): Observable<ApiResponse<any>> {
    return this.httpService.post(`/common/getMessagesForCategory/${category}`, clientData);
  }

  /**
   * Get Control Config
   */
  getControlConfig(clientData: ClientData, module: string = 'LOGIN'): Observable<ApiResponse<any>> {
    return this.httpService.post('/common/getControlConfig', clientData, {
      ControlConfig: { Module: module }
    });
  }

  /**
   * Get Session Time
   */
  getSessionTime(clientData: ClientData): Observable<ApiResponse<string>> {
    return this.httpService.post<string>('/common/getSessionTime', clientData);
  }

  /**
   * Get Menu
   */
  getMenu(clientData: ClientData, rolesList: any): Observable<ApiResponse<any>> {
    return this.httpService.post('/LogIn/getMenu', clientData, {
      RolesList: rolesList
    });
  }

  /**
   * Complete Login Flow - calls all necessary APIs in sequence
   */
  performLogin(
    username: string,
    password: string,
    deviceId: string,
    releaseVersion: string = '0.0.0'
  ): Observable<{
    roles: any;
    profile: any;
    messages: any;
    config: any;
    sessionTime: any;
    menu: any;
  }> {
    // Step 1: Initial client data
    const initialClientData: ClientData = {
      Location: '',
      ClientId: '9999',
      SiteId: 'LOGIN',
      LoggedInUser: username
    };

    // Step 2: Login model
    const loginModel: LoginModel = {
      UserName: username,
      Password: password,
      Environment: 'DEV',
      DataType: 'WAREHOUSE',
      DataTypeIdList: ['DFW004', 'DFW005', 'DFW009'],
      Application: 'RMX'
    };

    // Step 3: Get roles and site IDs first
    return this.getRolesSiteIds(initialClientData, loginModel).pipe(
      switchMap(rolesResponse => {
        if (rolesResponse.Status !== 'PASS') {
          throw new Error(rolesResponse.StatusMessage || 'Failed to get roles');
        }

        // Save token
        if (rolesResponse.Response.Token) {
          localStorage.setItem('token', rolesResponse.Response.Token);
        }

        // Update client data with first site
        const siteIds = Object.keys(rolesResponse.Response.rolesList);
        const firstSite = siteIds[0] || 'DFW009';
        const roles = rolesResponse.Response.rolesList[firstSite] || [];

        const updatedClientData: ClientData = {
          Location: '',
          ClientId: '1011',
          SiteId: firstSite,
          LoggedInUser: username,
          DeviceId: deviceId,
          Roles: roles
        };

        // Step 4: Call all other APIs in parallel
        return forkJoin({
          roles: Promise.resolve(rolesResponse),
          profile: this.getUserProfile(updatedClientData, { ReleaseVersion: releaseVersion }),
          messages: this.getMessagesForCategory(updatedClientData),
          config: this.getControlConfig(updatedClientData),
          sessionTime: this.getSessionTime(updatedClientData),
          menu: this.getMenu(updatedClientData, {
            Roles: rolesResponse.Response.rolesList
          })
        });
      })
    );
  }
}
