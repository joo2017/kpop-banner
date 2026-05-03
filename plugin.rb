# frozen_string_literal: true

# name: discourse-kpop-banner
# about: Displays the K-pop banner and serves private K-pop chart data through Discourse
# version: 0.1.0
# authors: kpann
# required_version: 2.7.0

enabled_site_setting :kpop_banner_enabled

register_asset "stylesheets/common/kpop-banner.scss"

module ::DiscourseKpopBanner
  PLUGIN_NAME = "discourse-kpop-banner"
end

after_initialize do
  module ::DiscourseKpopBanner
    class Engine < ::Rails::Engine
      engine_name "discourse_kpop_banner"
      isolate_namespace DiscourseKpopBanner
    end
  end

  class ::DiscourseKpopBanner::DataController < ::ApplicationController
    requires_plugin ::DiscourseKpopBanner::PLUGIN_NAME

    DATA_FILES = {
      "unified" => "charts-unified.json",
      "ichart" => "ichart-banner.json",
      "circle" => "circlechart-multi.json",
      "kpopping" => "kpopping-musicshows-details.json",
      "soridata" => "soridata-musicshow-wins-summary.json",
    }.freeze

    def show
      ensure_can_access_kpop_banner_data!

      source = params[:source].presence || "soridata"
      filename = DATA_FILES[source] || raise(Discourse::NotFound)
      path = data_file_path(filename)

      if !File.file?(path)
        raise Discourse::NotFound if required_source?(source)

        response.headers["Cache-Control"] = cache_control_header
        render json: empty_payload_for(source)
        return
      end

      payload = cached_json(path, source)
      response.headers["Cache-Control"] = cache_control_header
      response.headers["X-Kpop-Data-Mtime"] = File.mtime(path).to_i.to_s

      render json: filtered_payload(source, payload)
    rescue JSON::ParserError
      render json: { errors: ["Invalid K-pop banner JSON"] }, status: 500
    end

    def soridata_musicshow_wins
      params[:source] = "soridata"
      show
    end

    private

    def ensure_can_access_kpop_banner_data!
      raise Discourse::NotFound if !SiteSetting.kpop_banner_enabled

      case SiteSetting.kpop_banner_access_mode
      when "public_limited"
        return
      when "logged_in"
        ensure_logged_in
      when "admin"
        ensure_logged_in
        raise Discourse::InvalidAccess if !current_user&.admin?
      when "group"
        ensure_logged_in
        return if current_user&.staff?
        return if allowed_group_ids.present? && current_user.in_any_groups?(allowed_group_ids)

        raise Discourse::InvalidAccess
      else
        ensure_logged_in
      end
    end

    def allowed_group_ids
      Array(SiteSetting.kpop_banner_allowed_groups_map.presence || []).filter_map do |group_id|
        group_id.to_i if group_id.to_i.positive?
      end
    end

    def data_file_path(filename)
      File.join(SiteSetting.kpop_banner_data_dir, filename)
    end

    def required_source?(source)
      source == "soridata" || source == "kpopping"
    end

    def empty_payload_for(source)
      source == "circle" ? { charts: [] } : {}
    end

    def cached_json(path, source)
      mtime = File.mtime(path).to_i
      cache_key = "kpop-banner:data:#{source}:#{mtime}"
      Discourse.cache.fetch(cache_key, expires_in: SiteSetting.kpop_banner_cache_ttl_seconds.seconds) do
        JSON.parse(File.read(path))
      end
    end

    def filtered_payload(source, payload)
      return payload if SiteSetting.kpop_banner_access_mode != "public_limited"
      return payload if current_user&.staff?

      limit = params[:limit].present? ? params[:limit].to_i : 20
      limit = [[limit, 1].max, 50].min

      case source
      when "soridata"
        return payload if params[:raw].present? && current_user&.staff?

        chart = params[:chart].presence || "song"
        base = payload.slice("source", "generatedAt", "year")
        if params[:chart].present?
          key = chart == "artist" ? "artistWins" : "songWins"
          base.merge(key => Array(payload[key]).first(limit))
        else
          base.merge(
            "artistWins" => Array(payload["artistWins"]).first(limit),
            "songWins" => Array(payload["songWins"]).first(limit),
          )
        end
      else
        payload
      end
    end

    def cache_control_header
      SiteSetting.kpop_banner_access_mode == "public_limited" ? "public, max-age=60" : "private, max-age=60"
    end
  end

  ::DiscourseKpopBanner::Engine.routes.draw do
    get "/banner-data" => "data#show"
    get "/soridata-musicshow-wins" => "data#soridata_musicshow_wins"
  end

  Discourse::Application.routes.append do
    mount ::DiscourseKpopBanner::Engine, at: "/kpop"
  end
end
