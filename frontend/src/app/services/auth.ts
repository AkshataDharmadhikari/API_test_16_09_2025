// src/app/services/auth.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:4000/api/auth';

  // register returns created user + token
  async register(payload: { email: string; username: string; password: string }) {
    const res: any = await firstValueFrom(this.http.post(`${this.baseUrl}/register`, payload));
    // optionally store token after register
    if (res?.token) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('userId', res.id);
    }
    return res;
  }

  // login returns token + id
  async login(payload: { username: string; password: string }) {
    const res: any = await firstValueFrom(this.http.post(`${this.baseUrl}/login`, payload));
    if (res?.token) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('userId', res.id);
    }
    return res;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getUserId() {
    return localStorage.getItem('userId');
  }
}
