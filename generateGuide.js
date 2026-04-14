import * as fs from 'fs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                text: "AcadEx - Student Portal User Guide",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
                children: [new TextRun({ text: "Welcome to AcadEx!", bold: true })],
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "This step-by-step guide will walk you through everything you need to know to use the AcadEx Student Portal. We will cover how to log in, navigate your dashboard, take an exam, view your results, and update your settings.",
                spacing: { after: 400 },
            }),

            // Section 1: Login Page
            new Paragraph({
                text: "1. The Login Page",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "To access the portal, you first need to log in. Follow these simple steps:",
            }),
            new Paragraph({
                text: "• Step 1: Open the AcadEx website in your web browser.",
            }),
            new Paragraph({
                text: "• Step 2: On the login screen, make sure the 'Student' tab is selected (it has a Layers icon next to it).",
            }),
            new Paragraph({
                text: "• Step 3: Click the large 'Sign in with Google' button at the bottom of the card.",
            }),
            new Paragraph({
                text: "• Step 4: Choose your authorized Google account. Note: Only students with an '@anudip.org' email address (or specifically authorized emails) can log in. If you use a personal email, you will see a 'Not authorised' message.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The AcadEx Login Page showing the 'Student' tab selected and the 'Sign in with Google' button.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The AcadEx Login Page showing the 'Student' tab selected and the 'Sign in with Google' button.]", italics: true, color: "888888" })
                ]
            }),

            // Section 2: Dashboard
            new Paragraph({
                text: "2. Your Dashboard",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "Once you log in, you will be taken to your Dashboard. This is your main hub.",
            }),
            new Paragraph({
                text: "• Left Menu (Sidebar): Here you can navigate between 'Dashboard' (home), 'My Results' (past exams), and 'Settings' (your profile).",
            }),
            new Paragraph({
                text: "• Welcome Banner: Greets you by name and shows a quick summary of your activity.",
            }),
            new Paragraph({
                text: "• Available Exams Section: This area lists all the exams that are currently open for you to take. Each exam card shows the title, duration, total marks, and passing percentage.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The Student Dashboard showing the sidebar menu and a list of 'Available Exams' cards.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The Student Dashboard showing the sidebar menu and a list of 'Available Exams' cards.]", italics: true, color: "888888" })
                ]
            }),

            // Section 3: Starting an Exam
            new Paragraph({
                text: "3. Starting an Exam",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "When you are ready to take a test:",
            }),
            new Paragraph({
                text: "• Step 1: Find the exam you want to take under the 'Available Exams' section on your dashboard.",
            }),
            new Paragraph({
                text: "• Step 2: Click the 'Start Exam' button on the exam card.",
            }),
            new Paragraph({
                text: "• Step 3: A confirmation window will appear. It will remind you of the exam rules (e.g., do not switch tabs, do not exit full-screen mode).",
            }),
            new Paragraph({
                text: "• Step 4: Click 'Begin Exam' to start. The exam will automatically open in full-screen mode to prevent distractions.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The 'Start Exam' confirmation popup showing the exam rules and the 'Begin Exam' button.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The 'Start Exam' confirmation popup showing the exam rules and the 'Begin Exam' button.]", italics: true, color: "888888" })
                ]
            }),

            // Section 4: Exam Interface
            new Paragraph({
                text: "4. The Exam Interface",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "While taking the exam, you will see a clean, distraction-free interface.",
            }),
            new Paragraph({
                text: "• Timer: At the top right, a countdown timer shows how much time you have left. If the timer reaches zero, your exam will auto-submit.",
            }),
            new Paragraph({
                text: "• Question Area: The current question is displayed in the center. For Multiple Choice Questions (MCQs), click the circle next to your chosen answer. For Subjective questions, type your answer into the text box provided.",
            }),
            new Paragraph({
                text: "• Navigation: Use the 'Previous' and 'Next' buttons at the bottom to move between questions.",
            }),
            new Paragraph({
                text: "• Question Navigator (Right Side): A grid of numbers shows all questions. You can click any number to jump directly to that question. Answered questions will turn green.",
            }),
            new Paragraph({
                text: "• Submitting: Once you have answered all questions, go to the last question and click the 'Submit Exam' button. A final confirmation will ask if you are sure.",
            }),
            new Paragraph({
                text: "Important Note: AcadEx monitors your activity. If you try to switch browser tabs, exit full-screen, or copy-paste, the system will record a warning. Too many warnings may flag your exam.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The active Exam Interface showing a question, the timer at the top, and the question navigator grid on the right.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The active Exam Interface showing a question, the timer at the top, and the question navigator grid on the right.]", italics: true, color: "888888" })
                ]
            }),

            // Section 5: My Results
            new Paragraph({
                text: "5. My Results",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "After your exam is graded, you can view your performance.",
            }),
            new Paragraph({
                text: "• Step 1: Click on 'My Results' in the left sidebar menu.",
            }),
            new Paragraph({
                text: "• Step 2: You will see a list of all the exams you have taken. It will show your 'Status' (e.g., Graded, Pending Grading).",
            }),
            new Paragraph({
                text: "• Step 3: If the status is 'Graded' and the results are published, you will see your 'Total Marks Obtained'.",
            }),
            new Paragraph({
                text: "• Step 4: Click 'View Detailed Report' to see a full breakdown. This report shows your Overall Percentage, Total Marks, and a question-by-question review of what you got right or wrong.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The 'My Results' page showing a list of completed exams and the 'View Detailed Report' button.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The 'My Results' page showing a list of completed exams and the 'View Detailed Report' button.]", italics: true, color: "888888" })
                ]
            }),

            // Section 6: Settings
            new Paragraph({
                text: "6. Settings",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
                text: "You can manage your personal profile in the Settings area.",
            }),
            new Paragraph({
                text: "• Step 1: Click on 'Settings' in the left sidebar menu.",
            }),
            new Paragraph({
                text: "• Step 2: Here you can view your registered Email Address and Role.",
            }),
            new Paragraph({
                text: "• Step 3: You can update your 'Display Name' if needed.",
            }),
            new Paragraph({
                text: "• Step 4: Click 'Save Changes' to update your profile.",
            }),
            new Paragraph({
                text: "[Screenshot Placeholder: The 'Settings' page showing the user's profile information and the 'Save Changes' button.]",
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
                children: [
                    new TextRun({ text: "[Screenshot Placeholder: The 'Settings' page showing the user's profile information and the 'Save Changes' button.]", italics: true, color: "888888" })
                ]
            }),

            new Paragraph({
                text: "Thank you for using AcadEx! Good luck with your examinations.",
                spacing: { before: 400 },
                children: [new TextRun({ text: "Thank you for using AcadEx! Good luck with your examinations.", bold: true })]
            }),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("public/AcadEx_Student_User_Guide.docx", buffer);
    console.log("Document created successfully at public/AcadEx_Student_User_Guide.docx");
});
