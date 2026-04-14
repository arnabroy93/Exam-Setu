import * as fs from 'fs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                text: "AcadEx - Examiner Portal User Guide",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
                children: [new TextRun({ text: "Welcome to the AcadEx Examiner Portal!", bold: true })],
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "This step-by-step guide will walk you through everything you need to know to manage examinations. We will cover how to log in, use your dashboard, create and manage exams, monitor students live, grade subjective answers, and view student reports.",
                spacing: { after: 400 },
            }),

            // Section 1: Login Page
            new Paragraph({
                text: "1. The Login Page",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "To access the portal as an Examiner, follow these steps:",
            }),
            new Paragraph({
                text: "• Step 1: Open the AcadEx website in your web browser.",
            }),
            new Paragraph({
                text: "• Step 2: On the login screen, click on the 'Examiner' tab (it has a User Settings icon next to it).",
            }),
            new Paragraph({
                text: "• Step 3: Click the large 'Sign in with Google' button.",
            }),
            new Paragraph({
                text: "• Step 4: Choose your authorized Google account. Note: You must be granted Examiner access by an Admin to use this portal.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The AcadEx Login Page showing the 'Examiner' tab selected and the 'Sign in with Google' button.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The AcadEx Login Page showing the 'Examiner' tab selected and the 'Sign in with Google' button.]", italics: true, color: "888888" })
                ]
            }),

            // Section 2: Dashboard
            new Paragraph({
                text: "2. Your Dashboard",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "Once you log in, you will see your Examiner Dashboard. This is your control center.",
            }),
            new Paragraph({
                text: "• Left Menu (Sidebar): Use this to navigate between 'Dashboard', 'Live Monitoring', 'Manage Exams', 'Student Reports', and 'Settings'.",
            }),
            new Paragraph({
                text: "• Quick Stats: At the top, you will see summary cards showing the Total Exams you've created, Active Students, and Pending Grades.",
            }),
            new Paragraph({
                text: "• Recent Activity: A quick view of the latest exams you have been working on.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The Examiner Dashboard showing the sidebar menu, quick stats cards, and recent activity.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The Examiner Dashboard showing the sidebar menu, quick stats cards, and recent activity.]", italics: true, color: "888888" })
                ]
            }),

            // Section 3: Manage Exams
            new Paragraph({
                text: "3. Manage Exams (Creating & Editing)",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "This section allows you to create new tests or edit existing ones.",
            }),
            new Paragraph({
                text: "• Step 1: Click 'Manage Exams' in the left sidebar.",
            }),
            new Paragraph({
                text: "• Step 2: To make a new test, click the '+ Create New Exam' button.",
            }),
            new Paragraph({
                text: "• Step 3: Fill in the Exam Details: Title, Description, Duration (in minutes), and Passing Percentage.",
            }),
            new Paragraph({
                text: "• Step 4: Add Questions. Click 'Add Question'. You can choose 'Multiple Choice' (MCQ) or 'Subjective' (written answer).",
            }),
            new Paragraph({
                text: "• Step 5: For MCQs, type the question, add options, and select the correct answer. Assign 'Points' (marks) for the question.",
            }),
            new Paragraph({
                text: "• Step 6: Click 'Save Draft' to work on it later, or 'Publish Exam' to make it visible to students.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The 'Manage Exams' page showing the exam creator form, adding a question, and setting points.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The 'Manage Exams' page showing the exam creator form, adding a question, and setting points.]", italics: true, color: "888888" })
                ]
            }),

            // Section 4: Live Monitoring
            new Paragraph({
                text: "4. Live Monitoring",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "Watch students take the exam in real-time to prevent cheating.",
            }),
            new Paragraph({
                text: "• Step 1: Click 'Live Monitoring' in the left sidebar.",
            }),
            new Paragraph({
                text: "• Step 2: Select an active exam from the dropdown menu.",
            }),
            new Paragraph({
                text: "• Step 3: You will see a list of students currently taking the test. It shows their progress (e.g., Question 5 of 10).",
            }),
            new Paragraph({
                text: "• Step 4: Integrity Warnings: If a student tries to switch browser tabs or exit full-screen, a red warning icon will appear next to their name. You can click on the student to see exactly when the violation occurred.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The 'Live Monitoring' screen showing active students, their progress bars, and any cheating warnings.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The 'Live Monitoring' screen showing active students, their progress bars, and any cheating warnings.]", italics: true, color: "888888" })
                ]
            }),

            // Section 5: Student Reports & Grading
            new Paragraph({
                text: "5. Student Reports & Grading",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "After students submit their exams, you come here to grade them and publish results.",
            }),
            new Paragraph({
                text: "• Step 1: Click 'Student Reports' in the left sidebar.",
            }),
            new Paragraph({
                text: "• Step 2: Select the exam you want to review.",
            }),
            new Paragraph({
                text: "• Step 3: You will see a table of all students who took the exam. It shows their Total Marks Obtained and Overall Percentage.",
            }),
            new Paragraph({
                text: "• Step 4 (Manual Grading): If the exam had Subjective questions, the status will say 'Pending Grading'. Click on the student's name. Scroll down to their subjective answers, read them, and type the marks awarded into the box provided. Click 'Save Grades'.",
            }),
            new Paragraph({
                text: "• Step 5 (Publishing): Once graded, check the boxes next to the students' names and click the 'Publish' button. This allows students to see their scores on their own portal.",
            }),
            new Paragraph({
                text: "• Step 6 (Exporting): Click the 'Excel' or 'CSV' buttons to download a spreadsheet of all the grades for your records.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The 'Student Reports' table showing student scores, the 'Publish' button, and the manual grading interface for subjective questions.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The 'Student Reports' table showing student scores, the 'Publish' button, and the manual grading interface for subjective questions.]", italics: true, color: "888888" })
                ]
            }),

            // Section 6: Settings
            new Paragraph({
                text: "6. Settings",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "Manage your personal profile.",
            }),
            new Paragraph({
                text: "• Step 1: Click on 'Settings' in the left sidebar menu.",
            }),
            new Paragraph({
                text: "• Step 2: View your registered Email Address and Role (Examiner).",
            }),
            new Paragraph({
                text: "• Step 3: Update your 'Display Name' if necessary.",
            }),
            new Paragraph({
                text: "• Step 4: Click 'Save Changes' to apply updates.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The 'Settings' page showing the examiner's profile information and the 'Save Changes' button.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The 'Settings' page showing the examiner's profile information and the 'Save Changes' button.]", italics: true, color: "888888" })
                ]
            }),

            new Paragraph({
                text: "Thank you for using AcadEx to manage your examinations!",
                spacing: { before: 400 },
                children: [new TextRun({ text: "Thank you for using AcadEx to manage your examinations!", bold: true })]
            }),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("public/AcadEx_Examiner_User_Guide.docx", buffer);
    console.log("Document created successfully at public/AcadEx_Examiner_User_Guide.docx");
});
