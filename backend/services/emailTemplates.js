function bookingConfirmation({ recipientName, otherPartyName, date, startTime, role }) {
  const subject = `Appointment Confirmed - ${date} at ${startTime}`;
  const body = `
    <p>Hi ${recipientName},</p>
    <p>Your appointment ${role === 'patient' ? `with Dr. ${otherPartyName}` : `with patient ${otherPartyName}`}
       is confirmed for <b>${date} at ${startTime}</b>.</p>
    <p>A calendar invite has been sent to your Google Calendar (if connected).</p>
    <p>— Clinic Appointments Team</p>
  `;
  return { subject, body };
}

function cancellation({ recipientName, date, startTime, reason }) {
  const subject = `Appointment Cancelled - ${date} at ${startTime}`;
  const body = `
    <p>Hi ${recipientName},</p>
    <p>Your appointment scheduled for <b>${date} at ${startTime}</b> has been cancelled.</p>
    ${reason ? `<p>Reason: ${reason}</p>` : ''}
    <p>Please book a new slot at your convenience.</p>
    <p>— Clinic Appointments Team</p>
  `;
  return { subject, body };
}

function leaveNotice({ recipientName, doctorName, date, startTime }) {
  const subject = `Your doctor is unavailable on ${date}`;
  const body = `
    <p>Hi ${recipientName},</p>
    <p>Dr. ${doctorName} has marked <b>${date}</b> as unavailable, which affects your appointment
       scheduled at ${startTime}. This appointment has been cancelled.</p>
    <p>We're sorry for the inconvenience - please rebook a new slot.</p>
    <p>— Clinic Appointments Team</p>
  `;
  return { subject, body };
}

function reminder({ recipientName, date, startTime, otherPartyName, role }) {
  const subject = `Reminder: Appointment tomorrow at ${startTime}`;
  const body = `
    <p>Hi ${recipientName},</p>
    <p>This is a reminder of your appointment ${role === 'patient' ? `with Dr. ${otherPartyName}` : `with ${otherPartyName}`}
       on <b>${date} at ${startTime}</b>.</p>
    <p>— Clinic Appointments Team</p>
  `;
  return { subject, body };
}

function medicationReminder({ recipientName, medicineName, dosage }) {
  const subject = `Medication Reminder: ${medicineName}`;
  const body = `
    <p>Hi ${recipientName},</p>
    <p>It's time to take your medication: <b>${medicineName}</b> (${dosage || 'as prescribed'}).</p>
    <p>— Clinic Appointments Team</p>
  `;
  return { subject, body };
}

module.exports = { bookingConfirmation, cancellation, leaveNotice, reminder, medicationReminder };
