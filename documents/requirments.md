# Tutor Desk

I want to make a platform for teachers who have some students, now he want a web app where 
those should be possible,

# Main Features
  - There should be a modern landing page about the app. 
    - Contacts
    - About
    - Simplicity
    - focused
    - Motto
    - Developer Info
    - A lite animations
  - There will be three Role,
    - SuperAdmin, Teacher and Student
    - SuperAdmin
      - Can login.
      - Can create teacher - CURD.
      - Manage everything of the apps. - CURD
      - Have access all the teacher's workspaces data. - CURD.
      - Can disable teacher to prevent the access of this apps.
    - Teacher
      - Can able to join via google Authentication (Supabase Auth)
        - in this case he need to be permitted from super admin then he can start 
        using the app's all features.
      - Can create student profile - CRUD.
      - Can create subjects. - CRUD.
      - Can create exams for subjects - CRUD.
      - Can create questions for exams- CRUD.
        - Exams will be only MCQ type can able those following senarios,
          - 1minutes per MCQ
          - After 1minute skip to next questions.
          - can able to configure if skip now next time after completing exam those question can be showing or > [!NOTE]
          > like if one questiuon skips afterr 12s then once done with every question the question will be arrive with 48s remanig.
          > this is the most demanding part should not be buggy.
          - Once he left the current window then immidietly submit the exam.
          - Once submit the exam he can't able to participate again.
          - In phone if he left the app then immidietly submit the exam should be follow as same as web.
          - In web should track the mouse if it left the window then submit the exam.
          - When start exam in web should be in fullscreen mode. 
          - for phone should be same policy.
      - Can assign students to subjects - CRUD.
      - Students will get follow up exams, questions and can participate exams assigned by teacher.
      - Can able to see student wise submitted exams.
      - Can evaluate exams of every submitted exams of students.
      - Can take Re-exams of a student.
      - Can disable student access.
      - Can post assets to a subject and beside subject will be displayed upcoming exams and its date.
      - A nice view of report of every exams with nice statistics view for students.
    - Students 
      - Can able to login via teacher's created credentials.
      - Can view his assigned subject and its content.
      - Can participate exams.
      - Also able to see his submitted exams and its result.
      - Can do comment on assets posting of teacher.
      - Automate exam result after submit

# Techstack
_ I will use [Supabase](https://supabase.com/docs)
- Manual Authentication not using any service now.
- Angular SSR for web app.
  - PWA focused
  - Mobile first
- For design follow tailwindcss 
- Use [PrimeNG](https://primeng.org/) UI framework.

