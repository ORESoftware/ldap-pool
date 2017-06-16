//******************************************************************************************************************************
// this file allows you to configure network dependencies so that the Suman test runner can check to see if all require
// network components are live and ready to be incorporated in the test. Of course, you could just run the tests and see if
// they are live, but this feature allows you to have a fail-fast up-front check that will only run once, thus avoiding
// any potential overload of any of your network components that may already be under load.
// ******************************************************************************************************************************

let ldap = require('ldapjs');

//////////////////////////////////////////////////////////////

module.exports = data => {

  return {

    dependencies: {

      'start-ldap-server': [function (data, cb) {

        let server = ldap.createServer();

        server.on('error', function (e) {
          console.error(e.stack || e);
        });

        server.search('dc=example', function (req, res) {
          var obj = {
            dn: req.dn.toString(),
            attributes: {
              objectclass: ['organization', 'top'],
              o: 'example'
            }
          };

          if (req.filter.matches(obj.attributes)) {
            res.send(obj);
          }

          res.end();
        });

        server.bind('ou=people, o=example', function (req, res) {
          console.log('bind DN: ' + req.dn.toString());
          console.log('bind PW: ' + req.credentials);
          res.send({dog:true});
          res.end();
        });

        server.listen(3890, '127.0.0.1', cb);

      }]

    }

  }

};
