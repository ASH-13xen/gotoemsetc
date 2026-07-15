const { Router } = require('express');
const admsController = require('../controllers/adms.controller');

// Unauthenticated on purpose — the ZKTeco device speaks its own ADMS
// protocol, not JWT, and firmware hits these exact fixed paths.
const router = Router();

router.get('/cdata', admsController.handshake);
router.post('/cdata', admsController.pushData);
router.get('/getrequest', admsController.getRequest);
// Some firmware also posts command acks here — just acknowledge.
router.post('/devicecmd', (req, res) => res.type('text/plain').send('OK'));

module.exports = router;
