import { AfterViewChecked, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Socket, io } from 'socket.io-client';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
})
export class ChatComponent implements OnInit, OnDestroy {
  currUser;
  channelName;
  groupName;
  roomName;
  msgText = '';
  messages = [];
  activeUsers = [];
  selectedImage: string | ArrayBuffer | null = null;
  socket: Socket;

  constructor(
    private route: ActivatedRoute,
    public user: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    //get and parse initial details for sending messages
    this.route.paramMap.subscribe((params) => {
      this.channelName = params.get('channelName');
      this.groupName = params.get('name');
      this.roomName = this.groupName + this.channelName;
    });

    //get the current user
    this.user.user$.subscribe((val) => {
      this.currUser = val;
      console.log(this.currUser.avatar);
    });

    this.socket = io('http://localhost:3000'); //initialize socket

    //connection logic
    this.socket.on('connect', () => {
      const msgObject = this.parseMessage(
        `UPDATE: ${this.currUser.username} joined the channel`,
        'status'
      );

      this.socket.emit('join-room', msgObject);
      this.activeUsers.push(this.currUser.username);
    });

    //message receiving and status handling
    this.socket.on('receive-msg', (m) => {
      if (!this.activeUsers.includes(m.username)) {
        this.activeUsers.push(m.username);
      }

      if (m.type === 'status' && m.content.split(' ').includes('left')) {
        const idx = this.activeUsers.findIndex((u) => u === m.username);
        idx != -1 ? this.activeUsers.splice(idx, 1) : 'not found';
      }

      this.messages.push(m);
      console.log('receiving', this.messages);
    });
  }

  //cleanup logic -> disconnect socket and emit leave event
  ngOnDestroy(): void {
    const msgObject = this.parseMessage(
      `UPDATE: ${this.currUser.username} left the channel`,
      'status'
    );

    const idx = this.activeUsers.findIndex((u) => u === this.currUser.username);
    if (idx != -1) this.activeUsers.splice(idx, 1);

    this.socket.emit('leave-room', msgObject);
    this.socket.disconnect();
  }

  leaveChannel() {
    this.router.navigateByUrl('/groups');
  }

  //parse message object
  parseMessage(content, type) {
    const time = new Date();
    let hours = `${time.getHours()}`;
    let minutes = `${time.getMinutes()}`;
    if (minutes.length < 2) minutes = `0${minutes}`;

    if (hours.length < 2) hours = `0${hours}`;

    const msgObject = {
      content,
      time: `${hours}:${minutes}`,
      from: this.currUser.id,
      username: this.currUser.username,
      room: this.roomName,
      avatar: this.currUser.avatar,
      type,
    };

    return msgObject;
  }

  //send message when btn clicked
  sendMessage() {
    if (!this.msgText.trim()) alert('please enter some text to send!');
    const msgObject = this.parseMessage(this.msgText, 'message');

    this.messages.push(msgObject);

    // console.log('sending', this.messages);
    this.socket.emit('message', msgObject);
    this.msgText = '';
  }

  checkEnter(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage();
      event.preventDefault(); // Prevents any default behavior like form submission
    }
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      // console.log('File selected:', input.files[0]);

      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = () => {
        // Store the Base64-encoded image
        this.selectedImage = reader.result;

        // You can send the image here or attach it to the sendMessage() logic
        this.sendImage();
      };
      reader.readAsDataURL(file); // Convert to Base64
    }
  }

  sendImage() {
    if (this.selectedImage) {
      const msgData = this.parseMessage(this.selectedImage, 'image');
      console.log('msgData', msgData);

      this.messages.push(msgData);

      // Emit the image event via WebSocket
      this.socket.emit('imageMessage', msgData);

      // Clear the selected image after sending
      this.selectedImage = null;
    }
  }
}
