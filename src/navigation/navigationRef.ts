// src/navigation/navigationRef.ts
import { createNavigationContainerRef } from '@react-navigation/native';

export type RootParamList = {
  // Employee stack
  IncomingCall: {
    channel:    string;
    token:      string;
    appId:      string;
    callerName: string;
    callerId:   string;
  };
  EmployeeTabsRoot: undefined;
  // Admin stack
  Call: {
    employeeId:   string;
    employeeName: string;
  };
  AdminTabsRoot: undefined;
};

export const navigationRef = createNavigationContainerRef<RootParamList>();