import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  email = '';
  username = '';
  password = '';
  message = signal<string>('');

  async submit() {
    this.message.set('');
    try {
      await this.auth.register({ email: this.email, username: this.username, password: this.password });
      this.message.set('Registered successfully. You can now login.');
    } catch (err: any) {
      const msg = err?.error?.message || 'Registration failed';
      this.message.set(msg);
    }
  }
}
