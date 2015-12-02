(function(){
'use strict';
var _ =require('lodash');
var handlebars = require('handlebars');

module.exports = function (grunt) {
  	grunt.registerTask('apibuild', 'ndjs compile grunt task', function () {
      var options=this.options();
      var ndNodefiles=grunt.file.expand(options.ndNodeSrcGlob);
      var ndAngularfiles=grunt.file.expand(options.ndAngualrSrcGlob);

      grunt.log.debug('Doxing...');


      var filteredAngular=filterDox(getDox(ndAngularfiles));
      var filteredNode=filterDox(getDox(ndNodefiles));
      _.find(filteredNode.modules,{name:'job'}).jobs=filteredNode.corejobs;

      handlebars.registerHelper('paramarray', function(data) {
        var str='('+_.pluck(data,'name').join(',')+ ')';
        return new handlebars.SafeString (str);
      });
      handlebars.registerHelper('json', function(obj) {
        return JSON.stringify(obj);
      });

      var mainTemplateContent=require('fs').readFileSync(__dirname+'/templates/main.html','utf8');
      var mainTemplate = handlebars.compile(mainTemplateContent);
      var mainHtml = mainTemplate({angular:filteredAngular,node:filteredNode});

      var menuTemplateContent=require('fs').readFileSync(__dirname+'/templates/menu.html','utf8');
      var menuTemplate = handlebars.compile(menuTemplateContent);
      var menuHtml = menuTemplate({angular:filteredAngular,node:filteredNode});

      var currentPageHtml=require('fs').readFileSync(__dirname+'/../../app/api.html','utf8');
      console.log(/(<!--start-main-->)[\s\S]*(<!--end-main-->)/gm.test(currentPageHtml));
      currentPageHtml=currentPageHtml.replace(/(<!--start-main-->)[\s\S]*(<!--end-main-->)/,function(a,b,c){return b+'\n'+mainHtml+'\n'+c;});
      currentPageHtml=currentPageHtml.replace(/(<!--start-menu-->)[\s\S]*(<!--end-menu-->)/,function(a,b,c){return b+'\n'+menuHtml+'\n'+c;});

      require('fs').writeFileSync(__dirname+'/../../app/api.html',currentPageHtml);

    });
};

function getDox(listOfFiles)
{
  var dox = require('dox');
  var doc = function (file) {
    var buf = require('fs').readFileSync(file,'utf8');
    var obj = dox.parseComments(buf, {
      raw: true, api:true
    });
    return obj;
  };
  return _.map(listOfFiles,doc);
}
function filterDox(doxObj)
{
  var flatObjs=_.flatten(doxObj, true);
  var filtered={modules:[],directives:[],services:[],corejobs:[]};
  var lastObjWithMethods={};

  flatObjs.forEach(function(obj)
  {
    if(obj && obj.tags)
    {
      var indexedByTag= _.indexBy(obj.tags,'type');
      var getFiltered=function()
      {
        var ret={};
        var doxName=indexedByTag.name && indexedByTag.name.string.replace(/ directive| service| module| corejob/g,'');
        doxName=doxName|| obj && obj.ctx && obj.ctx.name;
        if(doxName){ret.name=doxName;}
        var doxDesc=indexedByTag.description && indexedByTag.description.string ;
        if(doxDesc){ret.description=doxDesc;}
        var doxExample=indexedByTag.example && indexedByTag.example.string ;
        if(doxExample){ret.example=doxExample;}
        var doxRet=indexedByTag.return && indexedByTag.return.string ;
        if(doxRet){ret.return=doxRet;}
        var doxParams=_.map(_.filter(obj.tags,{type:'param'}),function(param)
        {
          var paramRet= {};
          if(param.name){paramRet.name= param.name;}
          if(param.description){paramRet.description= param.description;}
          if(param.types){paramRet.type= param.types.join(',');}
          return paramRet;

        });
        if(doxParams.length>0){ret.params=doxParams;}
        return ret;
      };

      if(indexedByTag && indexedByTag.name && / module/.test(indexedByTag.name.string))
      {
        var mod=getFiltered();
        lastObjWithMethods=mod;
        filtered.modules.push(mod);
      }
      if(indexedByTag && indexedByTag.name && / corejob/.test(indexedByTag.name.string))
      {
        var corejob=getFiltered();
        lastObjWithMethods=corejob;
        filtered.corejobs.push(corejob);
      }

      if(indexedByTag && indexedByTag.name && / directive/.test(indexedByTag.name.string))
      {
        var dir=getFiltered();
        lastObjWithMethods=dir;
        filtered.directives.push(dir);

      }

      if(indexedByTag && indexedByTag.name && / service/.test(indexedByTag.name.string))
      {
        var serv=getFiltered();
        lastObjWithMethods=serv;
        filtered.services.push(serv);
      }

      if(_.get(obj,'ctx.type')==='function')
      {
        if(!lastObjWithMethods.methods){lastObjWithMethods.methods=[];}
        lastObjWithMethods.methods.push(getFiltered());
      }



    }
});

  if(filtered.modules.length===0)
  {
    delete filtered.modules;
  }
  if(filtered.directives.length===0)
  {
    delete filtered.directives;
  }
  if(filtered.services.length===0)
  {
    delete filtered.services;
  }
  if(filtered.corejobs.length===0)
  {
    delete filtered.corejobs;
  }
  return filtered;
}
})();

/*
grunt.registerMultiTask('nddox','create docs using dox',function()
{

    var html='';

    var getDivStr=function(value,divPrefix)
    {
      if(!value){return '';}
      return '<div class="dox-'+divPrefix+'">'+_.escape(value)+'</div>';
    };

    function getArrayTemplateAsString(arr,prefix)
    {
      if(!arr){return '';}

      return '<div class="dox-'+prefix+'s">'+_.map(arr,function(oneObj)
    {
      var ret='<div class="dox-'+prefix+'">';
      ret+=getDivStr(oneObj.name,'name');
      ret+=getDivStr(oneObj.type,'type');
      ret+=getDivStr(oneObj.description,'description');
      ret+=getArrayTemplateAsString(oneObj.params,'param');
      ret+=getDivStr(oneObj.return,'return');
      ret+=getArrayTemplateAsString(oneObj.methods,'method');
      ret+=getDivStr(oneObj.example,'example');
      ret+='</div>';

      return ret;

    }).join('\n')+'</div>';
    }

    html+=getArrayTemplateAsString(filtered.modules,'module');

    html+=getArrayTemplateAsString(filtered.services,'service');
    html+=getArrayTemplateAsString(filtered.directives,'directive');
    html+=getArrayTemplateAsString(filtered.corejobs,'corejob');

    html+='</div>\n';
    var prettyPrint = require('html').prettyPrint;
    grunt.file.write(file.dest, prettyPrint(html, {indent_size: 4}));


  });


});*/
