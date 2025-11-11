import { Injectable } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  ClientData,
  ApiResponse,
  LoginModel,
  UserProfile,
  Session
} from '../models/api.models';
import { CommonService } from './common-service';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  constructor(private commonService: CommonService) {}

  /**
   * Get Roles and Site IDs
   */
  getRolesSiteIds(clientData: ClientData, loginModel: LoginModel): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData('/LogIn/GetRolesSiteIds', clientData, {
      LogInModel: loginModel
    });
  }

  /**
   * Get User Profile
   */
  getUserProfile(clientData: ClientData, userProfile: Partial<UserProfile>): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData('/LogIn/getUserProfile', clientData, {
      UserProfile: userProfile
    });
  }

  /**
   * Get Messages for Category
   */
  getMessagesForCategory(clientData: ClientData, category: string = 'COM'): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData(`/common/getMessagesForCategory/${category}`, clientData);
  }

  /**
   * Get Control Config
   */
  getControlConfig(clientData: ClientData, module: string = 'LOGIN'): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData('/common/getControlConfig', clientData, {
      ControlConfig: { Module: module }
    });
  }

  /**
   * Get Session Time
   */
  getSessionTime(clientData: ClientData): Observable<ApiResponse<string>> {
    return this.commonService.postWithClientData<string>('/common/getSessionTime', clientData);
  }

  /**
   * Get Menu
   */
  getMenu(clientData: ClientData, rolesList: any): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData('/LogIn/getMenu', clientData, {
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
      Environment: 'QA026',
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

  /**
   * Logout user (call backend logout API if available)
   */
  logout(clientData: ClientData): Observable<ApiResponse<any>> {
    // If you have a logout endpoint on the backend
    return this.commonService.postWithClientData('/LogIn/logout', clientData);
  }

  /**
   * Refresh session
   */
  refreshSession(clientData: ClientData): Observable<ApiResponse<any>> {
    // If you have a refresh session endpoint
    return this.commonService.postWithClientData('/LogIn/refreshSession', clientData);
  }

  /**
   * Validate session
   */
  validateSession(clientData: ClientData): Observable<ApiResponse<any>> {
    // If you have a validate session endpoint
    return this.commonService.postWithClientData('/LogIn/validateSession', clientData);
  }
}
