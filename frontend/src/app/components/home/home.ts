import { CommonModule, NgIf } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, NgIf],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home {
  private router = inject(Router);
  private http = inject(HttpClient);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  chatSessions: Array<{
    _id: string;
    documentCount: number;
    documentNames: string[];
    documents: Array<{ _id: string; originalName: string; filename: string; path: string }>;
    archived?: boolean;
  }> = [];

  uploadMessage = '';
  selectedFiles: File[] | null = null;

  selectedChatSessionId: string | null = null;
  question = '';
  loadingAnswer = false;

  // Updated chatHistories to include optional rating per message
  chatHistories: { [chatSessionId: string]: { question: string; answer: string; rating?: 'up' | 'down' | null }[] } = {};

  sidebarOpen = true;
  expandedSessions = new Set<string>();

  openMenuSessionId: string | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.loadChatSessions();
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  sanitizeAndFormatAnswer(rawAnswer: string): SafeHtml {
    if (!rawAnswer) return '';

    // Basic replacements to convert common patterns into lists
    let formatted = rawAnswer;

    // Convert numbered lists starting with "1." or "1)"
    formatted = formatted.replace(/(?:^|\n)(\d+)[\.$$]\s+(.*)/g, (match, num, text) => {
      return `<li>${text.trim()}</li>`;
    });

    // Wrap consecutive <li> into <ol>
    formatted = formatted.replace(/(<li>.*<\/li>)+/gs, (match) => {
      return `<ol class="custom-ol">${match}</ol>`;
    });

    // Convert bullet points starting with "-", "*", or "•"
    formatted = formatted.replace(/(?:^|\n)[\-\•]\s+(.*)/g, (match, text) => {
      return `<li>${text.trim()}</li>`;
    });

    // Wrap consecutive <li> into <ul>
    formatted = formatted.replace(/(<li>.*<\/li>)+/gs, (match) => {
      return `<ul class="custom-ul">${match}</ul>`;
    });

    // Replace newlines with <br> for paragraphs
    formatted = formatted.replace(/\n/g, '<br>');

    // Sanitize and return
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    this.selectedFiles = Array.from(event.target.files);
    this.uploadMessage = '';
  }

  uploadFiles() {
    if (!this.selectedFiles || this.selectedFiles.length === 0) {
      this.uploadMessage = 'Please select PDF(s) to upload.';
      return;
    }

    const existingFilenames = this.chatSessions.flatMap(session => session.documents.map(d => d.filename));
    for (const file of this.selectedFiles) {
      if (existingFilenames.includes(file.name)) {
        this.uploadMessage = `File "${file.name}" already uploaded. Please open its chat.`;
        return;
      }
    }

    const token = localStorage.getItem('token');
    if (!token) {
      this.uploadMessage = 'Please login first';
      this.router.navigateByUrl('/login');
      return;
    }

    const formData = new FormData();
    for (const file of this.selectedFiles) {
      formData.append('files', file, file.name);
    }

    const headers = new HttpHeaders().set('x-auth-token', token);

    this.http.post('http://localhost:4000/api/upload', formData, { headers }).subscribe({
      next: (_res: any) => {
        this.uploadMessage = 'PDF(s) uploaded successfully!';
        this.selectedFiles = null;
        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }
        this.loadChatSessions();
      },
      error: (err) => {
        this.uploadMessage = err?.error?.message || 'Error uploading PDF(s).';
        console.error('Upload error', err);
      }
    });
  }

  loadChatSessions() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const headers = new HttpHeaders().set('x-auth-token', token);
    this.http.get('http://localhost:4000/api/upload/sessions', { headers }).subscribe({
      next: (res: any) => {
        this.chatSessions = res.sessions || [];
      },
      error: (err) => {
        console.error('Could not load chat sessions', err);
      }
    });
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    this.router.navigateByUrl('/login');
  }

  selectChatSession(sessionId: string) {
    this.selectedChatSessionId = sessionId;
    this.question = '';
    this.openMenuSessionId = null;

    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigateByUrl('/login');
      return;
    }

    this.http.get<{ messages: { question: string; answer: string; rating?: 'up' | 'down' | null }[] }>(
      `http://localhost:4000/api/chat/${sessionId}/history`,
      { headers: { 'x-auth-token': token } }
    ).subscribe({
      next: (res) => {
        this.chatHistories[sessionId] = res.messages || [];
      },
      error: (err) => {
        console.error('Failed to load chat history', err);
        this.chatHistories[sessionId] = [];
      }
    });
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  askQuestion() {
    if (!this.question.trim() || !this.selectedChatSessionId) {
      return;
    }
    this.loadingAnswer = true;
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first.');
      this.router.navigateByUrl('/login');
      this.loadingAnswer = false;
      return;
    }

    this.http.post('http://localhost:4000/api/chat', {
      chatSessionId: this.selectedChatSessionId,
      question: this.question
    }, {
      headers: { 'x-auth-token': token }
    }).subscribe({
      next: (res: any) => {
        if (!this.chatHistories[this.selectedChatSessionId!]) {
          this.chatHistories[this.selectedChatSessionId!] = [];
        }
        this.chatHistories[this.selectedChatSessionId!].push({ question: this.question, answer: res.answer, rating: null });
        this.question = '';
        this.loadingAnswer = false;
      },
      error: (err) => {
        alert(err?.error?.message || 'Error getting answer');
        this.loadingAnswer = false;
      }
    });
  }

  get selectedChatSessionName(): string | null {
    if (!this.selectedChatSessionId) return null;
    const session = this.chatSessions.find(s => s._id === this.selectedChatSessionId);
    if (!session) return null;
    if (session.documentCount === 1) {
      return session.documentNames[0];
    }
    return `Chat with ${session.documentCount} documents`;
  }

  toggleSessionExpansion(sessionId: string) {
    if (this.expandedSessions.has(sessionId)) {
      this.expandedSessions.delete(sessionId);
    } else {
      this.expandedSessions.add(sessionId);
    }
  }

  toggleMenu(sessionId: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.openMenuSessionId === sessionId) {
      this.openMenuSessionId = null;
    } else {
      this.openMenuSessionId = sessionId;
    }
  }

  closeMenu() {
    this.openMenuSessionId = null;
  }

  archiveSession(sessionId: string) {
    this.closeMenu();
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first.');
      this.router.navigateByUrl('/login');
      return;
    }
    const headers = new HttpHeaders().set('x-auth-token', token);
    this.http.post(`http://localhost:4000/api/chatSession/${sessionId}/archive`, {}, { headers }).subscribe({
      next: (res: any) => {
        const session = this.chatSessions.find(s => s._id === sessionId);
        if (session) {
          session.archived = res.archived;
        }
      },
      error: (err) => {
        alert(err?.error?.message || 'Error archiving chat session');
      }
    });
  }

  deleteSession(sessionId: string) {
    this.closeMenu();
    if (!confirm('Are you sure you want to delete this chat session? This action cannot be undone.')) {
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first.');
      this.router.navigateByUrl('/login');
      return;
    }
    const headers = new HttpHeaders().set('x-auth-token', token);
    this.http.delete(`http://localhost:4000/api/chatSession/${sessionId}`, { headers }).subscribe({
      next: () => {
        this.chatSessions = this.chatSessions.filter(s => s._id !== sessionId);
        if (this.selectedChatSessionId === sessionId) {
          this.selectedChatSessionId = null;
        }
      },
      error: (err) => {
        alert(err?.error?.message || 'Error deleting chat session');
      }
    });
  }

  // New methods for rating, copying, exporting

  rateAnswer(messageIndex: number, rating: 'up' | 'down'): void {
    if (!this.selectedChatSessionId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first.');
      this.router.navigateByUrl('/login');
      return;
    }

  
    const headers = new HttpHeaders().set('x-auth-token', token);
    const sessionId = this.selectedChatSessionId; // local non-null variable
  
    this.http.post(
      `http://localhost:4000/api/chat/${sessionId}/rate`,
      { messageIndex, rating },
      { headers }
    ).subscribe({
      next: () => {
        if (this.chatHistories[sessionId]) {
          this.chatHistories[sessionId][messageIndex].rating = rating;
        }
      },
      error: (err) => {
        alert(err?.error?.message || 'Error rating answer');
      }
    });
  }

  copyAnswer(answer: string) {
    navigator.clipboard.writeText(answer).then(() => {
      alert('Answer copied to clipboard!');
    }, () => {
      alert('Failed to copy answer.');
    });
  }

  exportChat() {
    if (!this.selectedChatSessionId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first.');
      this.router.navigateByUrl('/login');
      return;
    }

    const headers = new HttpHeaders().set('x-auth-token', token);
  
    this.http.get(`http://localhost:4000/api/chat/${this.selectedChatSessionId}/export`, {
      headers,
      responseType: 'blob' // important to get binary data
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${this.selectedChatSessionId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        alert(err?.error?.message || 'Error exporting PDF');
      }
    });
  }
}