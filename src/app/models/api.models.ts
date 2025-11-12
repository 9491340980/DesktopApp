export interface ClientData {
  Location: string;
  ClientId: string;
  SiteId: string;
  LoggedInUser?: string;
  DeviceId?: string;
  Roles?: string[];
}

export interface UIData {
  OperationId?: string;
  OperCategory?: string;
  Category?: string;
}

export interface ErrorMessage {
  ErrorDetails: any;
  InnerException: any;
  ErrorType: any;
  MessageNumber: number;
  Message: string;
  CurrentMessage: string;
  Category: string;
  Details: string;
  AttentionLevel: any;
  ActionButtonType: any;
  ErrorId: any;
  MessageType: any;
  ClientData: any;
  ErrorCode: any;
  Notes?: any;
}



export interface ApiResponse<T = any> {
  Status: 'PASS' | 'FAIL';
  StatusMessage: string;
  ErrorMessage: ErrorMessage;
  Response: T;
}

export interface ApiRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: { [key: string]: string };
  showLoader?: boolean;
  showError?: boolean;
  timeout?: number;
}

export interface LoginModel {
  UserName: string;
  Password: string;
  Environment?: string;
  DataType?: string;
  DataTypeIdList?: string[];
  Application?: string;
}

export interface UserProfile {
  ClientId: string;
  Loc: string;
  UserId: string;
  SiteId: string;
  LanguagePreference: string;
  DeviceId: string;
  DefaultOperations: { [key: string]: string };
  BookmarkOperations: { [key: string]: string };
  ReleaseVersion: string;
}

export interface Session {
  SeqId: number;
  LogInTimestamp: string;
  LogOffTimestamp: string | null;
  MachineName: string;
  ApplicationUser: string;
  Status: string;
  Loc: string;
  SiteId: string;
  ClientId: string;
  AddTs: string;
  AddWho: string;
  EditTs: string | null;
  EditWho: string;
  ReleaseVersion: string;
}
export interface AuthUser {
  userId: string;
  username: string;
  clientId: string;
  siteId: string;
  roles: { [key: string]: string[] };
  token: string;
}

interface MenuItem {
  Title: string;
  OperationId: string;
  Category: string;
  Module: string;
  RouterLink: string;
  HasSubMenu: boolean;
  SubMenu?: SubMenuItem[];
  Icon?: string;
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
