 
export class RedisListsStorage extends BaseListsStorage{

    _to_result(results){
        if( results){
            if (len(results) == 1){
                return results[0]
            }else{
                return tuple(results)}
              }
    }
    // @property
    get redis(){
        // '''
        // Lazy load the redis connection
        // '''
        try{
          return this._redis
        }
        catch(err){
          except AttributeError:
              this._redis = get_redis_connection()
              return this._redis
        }
    }
    get_keys(list_names){
        return [this.get_key(list_name) for list_name in list_names]
    }
    add(**kwargs){
        if (kwargs)
            pipe = this.redis.pipeline()

            for( list_name, values in six.iteritems(kwargs)){
                if( values){
                    key = this.get_key(list_name)
                    for( value in values){
                        pipe.rpush(key, value)}
                    // # Removes items from list's head
                    pipe.ltrim(key, -this.max_length, -1)}
            }
            pipe.execute()
            }
    remove(**kwargs){
        if (kwargs){
            pipe = this.redis.pipeline()

            for( list_name, values in six.iteritems(kwargs)){
                key = this.get_key(list_name)
                for( value in values:){
                    # Removes all occurrences of value in the list
                    pipe.lrem(key, 0, value)}
}
            pipe.execute()
            }
          }
    count(*args){
        if (args){
            keys = this.get_keys(args)
            pipe = this.redis.pipeline()
            for (key in keys){
                pipe.llen(key)}
            return this._to_result(pipe.execute())}
    }
    get(*args){
        if (args){
            keys = this.get_keys(args)
            pipe = this.redis.pipeline()
            for (key in keys){
                pipe.lrange(key, 0, -1)}
            results = pipe.execute()
            results = [list(map(this.data_type, items)) for items in results]
            return this._to_result(results)}
    }
    flush(*args){
        if( args){
            keys = this.get_keys(args)
            this.redis.delete(*keys)}
    }
  }