import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
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
   * Get Device ID
   */
  getDeviceId(clientData: ClientData): Observable<ApiResponse<any>> {
    return this.commonService.postWithClientData('/utilities/getDeviceId', clientData);
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
   * Complete Login Flow - Matches existing flow with clientData updates
   */
  performLogin(
    username: string,
    password: string,
    deviceId: string,
    releaseVersion: string,
    clientName?: string
  ): Observable<LoginResponse> {
    // Get configuration from ConfigService
    const config = this.configService.getConfig();
    const sharedSecurity = this.configService.getSharedSecurity();

    // Get site IDs based on client name if provided
    let dataTypeIdList: string[] = [];
    if (clientName) {
      const clientConfig = this.configService.getClientConfig(clientName);
      dataTypeIdList = clientConfig?.siteIds || [];
    }

    // If no client name or site IDs found, use first client's site IDs
    if (dataTypeIdList.length === 0) {
      const firstClient = this.configService.getAllClients()[0];
      dataTypeIdList = firstClient?.siteIds || [];
    }

    // Step 1: Initial client data for login
    let clientData: ClientData = {
      Location: '',
      ClientId: '9999',
      SiteId: 'LOGIN',
      LoggedInUser: username
    };

    // Step 2: Login model using configuration
    const loginModel: LoginModel = {
      UserName: username,
      Password: password,
      Environment: config.env,
      DataType: sharedSecurity.DataType,
      DataTypeIdList: dataTypeIdList,
      Application: sharedSecurity.Application
    };

    // Step 3: Get roles and site IDs first
    return this.getRolesSiteIds(clientData, loginModel).pipe(
      tap(rolesResponse => {
        if (rolesResponse.Status !== 'PASS') {
          throw new Error(rolesResponse.StatusMessage || 'Failed to get roles');
        }

        // Save token
        if (rolesResponse.Response.Token) {
          localStorage.setItem(StorageKey.TOKEN, rolesResponse.Response.Token);
        }

        // Save roles data
        if (rolesResponse.Response.rolesList) {
          localStorage.setItem(StorageKey.ROLES_LIST, JSON.stringify(rolesResponse.Response.rolesList));
          localStorage.setItem(StorageKey.SITE_IDS, JSON.stringify(Object.keys(rolesResponse.Response.rolesList)));
        }

        // Save username
        localStorage.setItem(StorageKey.USERNAME, username);
        localStorage.setItem('addWho', username); // For compatibility with existing code
      }),
      switchMap(rolesResponse => {
        // Update client data with first site for subsequent calls
        const siteIds = Object.keys(rolesResponse.Response.rolesList);
        const firstSite = siteIds[0] || (dataTypeIdList[0] || 'DFW009');

        // Update clientData for user profile call
        clientData = {
          Location: '',
          ClientId: '1011',
          SiteId: firstSite,
          LoggedInUser: username,
          DeviceId: deviceId || ''
        };

        // Save initial clientData
        localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(clientData));

        // Get user profile with device ID and release version
        const userProfileData: Partial<UserProfile> = {
          ReleaseVersion: releaseVersion
        };

        if (deviceId) {
          userProfileData.DeviceId = deviceId;
        }

        return this.getUserProfile(clientData, userProfileData).pipe(
          map(profileResponse => ({
            rolesResponse,
            profileResponse,
            clientData
          }))
        );
      }),
      switchMap(({ rolesResponse, profileResponse, clientData: currentClientData }) => {
        if (profileResponse.Status !== 'PASS') {
          // If profile fails, try to get device ID
          if (!currentClientData.DeviceId) {
            return this.getDeviceId(currentClientData).pipe(
              switchMap(deviceResponse => {
                if (deviceResponse.Status === 'PASS' && deviceResponse.Response?.DeviceId) {
                  currentClientData.DeviceId = deviceResponse.Response.DeviceId;
                  let deviceID:any=currentClientData.DeviceId
                  localStorage.setItem(StorageKey.DEVICE_ID, deviceID);
                  localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(currentClientData));
                }

                // Return error response but continue flow
                return of<LoginResponse>({
                  clientData: currentClientData,
                  roles: rolesResponse,
                  profile: { Status: 'FAIL', Response: null },
                  messages: null,
                  config: null,
                  sessionTime: null,
                  menu: null
                });
              })
            );
          }
          throw new Error(profileResponse.StatusMessage || 'Failed to get user profile');
        }

        // Update clientData with profile information
        const profile = profileResponse.Response.UserProfile;
        currentClientData.Location = profile.Loc;
        currentClientData.ClientId = profile.ClientId;
        currentClientData.SiteId = profile.SiteId;

        if (profile.DeviceId) {
          currentClientData.DeviceId = profile.DeviceId;
        }

        // Get roles for this specific site (getRolesBySiteId equivalent)
        const rolesBySiteId = rolesResponse.Response.rolesList[currentClientData.SiteId] || [];
        currentClientData.Roles = rolesBySiteId;

        // Save updated clientData with all fields including Roles
        localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(currentClientData));
        localStorage.setItem(StorageKey.USER_PROFILE, JSON.stringify(profile));
        localStorage.setItem(StorageKey.CLIENT_ID, profile.ClientId);
        localStorage.setItem(StorageKey.SITE_ID, profile.SiteId);
        localStorage.setItem(StorageKey.LOCATION, profile.Loc);

        // Save UserId if present
        if (profile.UserId) {
          localStorage.setItem(StorageKey.USER_ID, profile.UserId);
        }

        // Save Session if present
        if (profileResponse.Response.Session) {
          localStorage.setItem(StorageKey.SESSION, JSON.stringify(profileResponse.Response.Session));
        }

        // Now make parallel calls with the updated clientData
        return forkJoin({
          messages: this.getMessagesForCategory(currentClientData),
          config: this.getControlConfig(currentClientData),
          sessionTime: this.getSessionTime(currentClientData),
          menu: this.getMenu(currentClientData, {
            Roles: rolesResponse.Response.rolesList
          })
        }).pipe(
          map(parallelResults => ({
            clientData: currentClientData,
            roles: rolesResponse,
            profile: profileResponse,
            messages: parallelResults.messages,
            config: parallelResults.config,
            sessionTime: parallelResults.sessionTime,
            menu: parallelResults.menu
          }))
        );
      })
    );
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
