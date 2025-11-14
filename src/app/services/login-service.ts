import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import {
  ClientData,
  ApiResponse,
  LoginModel,
  UserProfile
} from '../models/api.models';
import { CommonService } from './common-service';
import { ConfigModule, StorageKey } from '../enums/app-constants.enum';
import { ConfigService } from './config-service';

/**
 * Login Response Interface
 */
export interface LoginResponse {
  clientData: ClientData;
  roles: any;
  profile: any;
  messages: any;
  config: any;
  sessionTime: any;
  menu: any;
  deviceId?: any;
  navigateTo?: string;  // For routing after login
}

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  constructor(
    private commonService: CommonService,
    private configService: ConfigService
  ) {}

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
  getMessagesForCategory(clientData: ClientData, category: string = ConfigModule.COMMON): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData(`/common/getMessagesForCategory/${category}`, clientData);
  }

  /**
   * Get Control Config
   */
  getControlConfig(clientData: ClientData, module: string = ConfigModule.LOGIN): Observable<ApiResponse<any>> {
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
   * Get Device ID
   */
  getDeviceId(clientData: ClientData): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData('/utilities/getDeviceId', clientData, {}, {
      showError: false
    });
  }

  /**
   * Get ALL siteIds from ALL clients
   */
  private getAllSiteIds(): string[] {
    const allClients = this.configService.getAllClients();
    const siteIds: string[] = [];

    allClients.forEach(client => {
      client.siteIds.forEach(siteId => {
        if (siteIds.indexOf(siteId) === -1) {
          siteIds.push(siteId);
        }
      });
    });

    return siteIds;
  }

  /**
   * ✅ FINAL: Complete Login Flow with getUserProfile failure handling
   */
  performLogin(
    username: string,
    password: string,
    releaseVersion: string,
    clientName?: string
  ): Observable<LoginResponse> {
    const config = this.configService.getConfig();
    const sharedSecurity = this.configService.getSharedSecurity();
    const dataTypeIdList = this.getAllSiteIds();

    // Step 1: Initial client data (9999/LOGIN)
    let clientData: ClientData = {
      Location: '',
      ClientId: '9999',
      SiteId: 'LOGIN',
      LoggedInUser: username
    };

    const loginModel: LoginModel = {
      UserName: username,
      Password: password,
      Environment: config.env,
      DataType: sharedSecurity.DataType,
      DataTypeIdList: dataTypeIdList,
      Application: sharedSecurity.Application
    };

    // Step 2: Get roles and site IDs
    return this.getRolesSiteIds(clientData, loginModel).pipe(
      tap(rolesResponse => {
        if (rolesResponse.Status !== 'PASS') {
          throw new Error(rolesResponse.StatusMessage || 'Failed to get roles');
        }

        if (rolesResponse.Response.Token) {
          localStorage.setItem(StorageKey.TOKEN, rolesResponse.Response.Token);
        }

        if (rolesResponse.Response.rolesList) {
          localStorage.setItem(StorageKey.ROLES_LIST, JSON.stringify(rolesResponse.Response.rolesList));
          localStorage.setItem(StorageKey.SITE_IDS, JSON.stringify(Object.keys(rolesResponse.Response.rolesList)));
        }

        localStorage.setItem(StorageKey.USERNAME, username);
        localStorage.setItem('addWho', username);
      }),
      switchMap(rolesResponse => {
        // Step 3: Check WorkStationName
        const workstationName = localStorage.getItem('WorkStationName');
        if (workstationName) {
          clientData.DeviceId = workstationName;
          localStorage.setItem(StorageKey.DEVICE_ID, workstationName);
        }

        localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(clientData));

        if (localStorage.getItem(StorageKey.RELEASE_VERSION)) {
          releaseVersion = localStorage.getItem(StorageKey.RELEASE_VERSION) || releaseVersion;
        }

        const userProfileData: Partial<UserProfile> = {
          ReleaseVersion: releaseVersion
        };

        // Step 4: Get user profile
        return this.getUserProfile(clientData, userProfileData).pipe(
          map(profileResponse => ({
            rolesResponse,
            profileResponse,
            clientData
          }))
        );
      }),
      switchMap(({ rolesResponse, profileResponse, clientData: currentClientData }) => {
        // ✅ Handle getUserProfile FAILURE - Navigate to user-profile
        if (profileResponse.Status !== 'PASS') {
          console.warn('getUserProfile failed, calling getDeviceId and redirecting to user-profile');
          // Call getDeviceId and navigate to user-profile
          return this.getDeviceId(currentClientData).pipe(
            tap(deviceResponse => {
              if (deviceResponse.Status === 'PASS' && deviceResponse.Response?.DeviceId) {
                currentClientData.DeviceId = deviceResponse.Response.DeviceId;
                localStorage.setItem(StorageKey.DEVICE_ID, deviceResponse.Response.DeviceId);
                localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(currentClientData));
                console.log('✅ Updated DeviceId from getDeviceId API:', deviceResponse.Response.DeviceId);
              }
            }),
            catchError(error => {
              console.warn('⚠️ getDeviceId also failed (non-critical):', error);
              return of({ Status: 'FAIL', Response: null } as ApiResponse<any>);
            }),
            map(deviceResponse => ({
              clientData: currentClientData,
              roles: rolesResponse,
              profile: profileResponse,
              messages: null,
              config: null,
              sessionTime: null,
              menu: null,
              deviceId: deviceResponse,
              navigateTo: 'user-profile'  // ✅ Signal to navigate to user-profile
            }))
          );
        }

        // ✅ getUserProfile SUCCESS - Continue with normal flow
        const profile = profileResponse.Response.UserProfile;
        currentClientData.Location = profile.Loc;
        currentClientData.ClientId = profile.ClientId;
        currentClientData.SiteId = profile.SiteId;

        if (profile.DeviceId) {
          currentClientData.DeviceId = profile.DeviceId;
          localStorage.setItem(StorageKey.DEVICE_ID, profile.DeviceId);
        }

        localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(currentClientData));
        localStorage.setItem(StorageKey.USER_PROFILE, JSON.stringify(profile));
        localStorage.setItem(StorageKey.CLIENT_ID, profile.ClientId);
        localStorage.setItem(StorageKey.SITE_ID, profile.SiteId);
        localStorage.setItem(StorageKey.LOCATION, profile.Loc);
        localStorage.setItem('module', 'COM');

        if (profile.UserId) {
          localStorage.setItem(StorageKey.USER_ID, profile.UserId);
        }

        if (profileResponse.Response.Session) {
          localStorage.setItem(StorageKey.SESSION, JSON.stringify(profileResponse.Response.Session));
        }

        // Step 5: Make parallel calls
        return forkJoin({
          messages: this.getMessagesForCategory(currentClientData),
          config: this.getControlConfig(currentClientData),
          sessionTime: this.getSessionTime(currentClientData),
          menu: this.getMenu(currentClientData, {
            Roles: rolesResponse.Response.rolesList
          }),
          deviceId: this.getDeviceId(currentClientData).pipe(
            catchError(error => {
              console.warn('⚠️ getDeviceId failed (non-critical):', error);
              return of({ Status: 'FAIL', Response: null } as ApiResponse<any>);
            })
          )
        }).pipe(
          tap(parallelResults => {
            if (parallelResults.deviceId.Status === 'PASS' && parallelResults.deviceId.Response?.DeviceId) {
              currentClientData.DeviceId = parallelResults.deviceId.Response.DeviceId;
              localStorage.setItem(StorageKey.DEVICE_ID, parallelResults.deviceId.Response.DeviceId);
              localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(currentClientData));
            }
          }),
          map(parallelResults => ({
            clientData: currentClientData,
            roles: rolesResponse,
            profile: profileResponse,
            messages: parallelResults.messages,
            config: parallelResults.config,
            sessionTime: parallelResults.sessionTime,
            menu: parallelResults.menu,
            deviceId: parallelResults.deviceId,
            navigateTo: 'dashboard'  // ✅ Signal to navigate to dashboard
          }))
        );
      })
    );
  }

  /**
   * Filter roles by site
   */
  filterRolesBySite(siteId: string): void {
    const rolesSiteIds = JSON.parse(localStorage.getItem(StorageKey.ROLES_LIST) || '{}');
    const rolesBySiteId: any = {};

    if (rolesSiteIds && rolesSiteIds[siteId]) {
      rolesBySiteId[siteId] = rolesSiteIds[siteId];
      localStorage.setItem('rolesList', JSON.stringify(rolesBySiteId));

      const clientData = JSON.parse(localStorage.getItem(StorageKey.CLIENT_DATA) || '{}');
      clientData.Roles = rolesSiteIds[siteId];
      localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(clientData));

      console.log('✅ Filtered roles for site', siteId, ':', rolesSiteIds[siteId]);
    }
  }

  /**
   * Logout user
   */
  logout(clientData: ClientData): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData('/LogIn/logout', clientData);
  }

  /**
   * Refresh session
   */
  refreshSession(clientData: ClientData): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData('/LogIn/refreshSession', clientData);
  }

  /**
   * Validate session
   */
  validateSession(clientData: ClientData): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData('/LogIn/validateSession', clientData);
  }
}
