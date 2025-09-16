import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  username = '';
  password = '';
  message = signal<string>('');

  async submit() {
    this.message.set('');
    try {
      await this.auth.login({ username: this.username, password: this.password });
      this.message.set('Logged in successfully');
      this.router.navigateByUrl('/home');
    } catch (err: any) {
      const msg = err?.error?.message || 'Login failed';
      this.message.set(msg);
    }
  }
}
