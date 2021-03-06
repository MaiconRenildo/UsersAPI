const knex=require("../database/connection")
const User=require('./User.js')
const Validation=require('./Validation')
const bcrypt=require("bcrypt")
const Email=require('../email/sendEmail')

class PasswordToken{

  async create(email){
    let result=await User.findByEmail(email);
    if(result.status){

      let token=this.create_UUID()
      let date=Date.now()
      try{
        await knex.insert({
          user_id:result.res.id,
          used:0,
          token:token,
          date:date
        }).table("passwordtokens");

        try{
          await Email.send(result.res.name,result.res.email,token)
          return {status:true,statusCode:200,email:result.res.email}
        }catch(err){
          return {status:false,statusCode:400,err:err}
        }

      }catch(err){
        return {status:false,statusCode:400,err:err}
      }
    }else{
      return {status:false,statusCode:404,err:"O e-mail informado não existe no banco."}
    }
  }

  create_UUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
  }
  
  async validate(token){
    try{
      let result=await knex.select().where({token:token}).table("passwordtokens");
      if(result.length>0){
        let tk=result[0];

        if(tk.used){
          return {status:false,statusCode:400,err:'Esse token já foi utilizado'};
        }

        let date=this.timeValidation(tk.date);
        if(date==false){
          return {status:false,statusCode:400,err:'Esse token expirou'};
        }

        return {status:true,statusCode:200,id:tk.user_id}
      }else{
        return {status:false,statusCode:400,err:'O Token não foi encontrado'};
      }
    }catch(err){
      return {status:false,statusCode:400,err:'Não foi possível validar o token. Tente novamente'};
    }
  }
  
  timeValidation(before){
    const difference=1800000  //Tempo em ms -> Equivale a 30min
    let now=Date.now()
    if(now-before>difference){
      return false;
    }else{
      true;
    }
  }

  async changePassword(newPassword,id,token){
    
    //Valida a senha
    if(Validation.password(newPassword)==0){
      return {status:false,statusCode:400,err:'Senha inválida'};
    }

    //Valida o id
    if(Validation.id(id)==0){
      return {status:false,statusCode:400,err:'Id inválido'};
    }
    //verifica se o usuario com determinado id existe
    let resultId=await User.findById(id)
    if(resultId.status==false){
      return resultId;
    }

    //Verifica se o token é valido
    let resultToken=await this.validate(token);
    if(resultToken.status==false){
      return resultToken;
    }

    //Verifica se o id do token bate com o id do usuário
    if(resultId.res.id!=resultToken.id){
      return {status:false,statusCode:400,err:'O token não pertence a este usuário'};
    }

    //Cria a nova senha
    let hash=await bcrypt.hash(newPassword,5);
    try{
      await knex.update({password:hash}).where({id:id}).table("users");
      await this.setUsed(token);
      return {status:true,statusCode:200,res:'Senha atualizada com sucesso'}
    }catch(err){
      return {status:false,statusCode:400,err:err};
    }
  }
  
  async setUsed(token){
    await knex.update({used:1}).where({token:token}).table("passwordtokens");
  }  
}

module.exports=new PasswordToken();